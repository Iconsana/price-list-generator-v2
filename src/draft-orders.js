// Draft Orders API Integration - Enhanced for QR Code Integration

import express from 'express';
import QRCode from 'qrcode';

const router = express.Router();

class DraftOrderManager {
    constructor(shopifyConfig) {
        this.shopify = shopifyConfig;
        this.baseURL = `https://${shopifyConfig.shop}.myshopify.com`;
    }

    // Create draft order from price list
    async createDraftOrder(priceListData) {
        const draftOrderPayload = {
            draft_order: {
                line_items: priceListData.products.map(product => {
                    const variant = product.variants && product.variants[0] ? product.variants[0] : {};
                    const variantId = variant.id ? variant.id.split('/').pop() : product.id.split('/').pop();
                    const basePrice = variant.price || 0;
                    const finalPrice = product.pricing ? product.pricing.finalPrice : basePrice;
                    
                    return {
                        variant_id: variantId,
                        quantity: product.quantity || 1,
                        price: finalPrice.toString()
                    };
                }),
                
                customer: {
                    email: priceListData.clientEmail,
                    first_name: priceListData.clientName?.split(' ')[0] || '',
                    last_name: priceListData.clientName?.split(' ').slice(1).join(' ') || ''
                },
                
                note: `Price List Generated: ${priceListData.listId || 'Unknown'}
Client: ${priceListData.clientName}
Pricing Tier: ${priceListData.pricingTier}
Generated: ${new Date().toISOString()}`,

                tags: [
                    'price-list-generated',
                    `tier-${priceListData.pricingTier}`,
                    `list-${priceListData.listId}`
                ].join(','),

                // Set expiration (30 days default)
                use_customer_default_address: false,
                
                // Custom attributes for tracking
                note_attributes: [
                    { name: 'price_list_id', value: priceListData.listId },
                    { name: 'pricing_tier', value: priceListData.pricingTier },
                    { name: 'generated_by', value: 'price-list-generator' }
                ]
            }
        };

        try {
            const response = await this.makeShopifyRequest('POST', '/admin/api/2024-07/draft_orders.json', draftOrderPayload);
            return response.draft_order;
        } catch (error) {
            console.error('Failed to create draft order:', error);
            throw new Error(`Draft order creation failed: ${error.message}`);
        }
    }

    // Generate QR code data for draft order
    generateQRData(draftOrder, priceListData) {
        return {
            checkoutURL: draftOrder.invoice_url,
            draftOrderId: draftOrder.id,
            clientName: priceListData.clientName || 'Customer',
            totalAmount: draftOrder.total_price,
            itemCount: draftOrder.line_items.length,
            validUntil: this.calculateExpirationDate(30), // 30 days
            generatedAt: new Date().toISOString()
        };
    }

    // Generate QR code image as base64
    async generateQRCodeImage(url, options = {}) {
        try {
            const qrOptions = {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 200,
                ...options
            };
            
            const qrCodeDataURL = await QRCode.toDataURL(url, qrOptions);
            return qrCodeDataURL;
        } catch (error) {
            console.error('QR code generation error:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    // Create cart permalink (alternative approach)
    createCartPermalink(products, discountCode = null) {
        const cartItems = products.map(product => 
            `${product.variant_id}:${product.quantity || 1}`
        ).join(',');
        
        let cartURL = `${this.baseURL}/cart/${cartItems}`;
        
        const params = new URLSearchParams();
        
        if (discountCode) {
            params.append('discount', discountCode);
        }
        
        // Add note for tracking
        params.append('note', 'Generated from Price List Generator');
        
        if (params.toString()) {
            cartURL += `?${params.toString()}`;
        }
        
        return cartURL;
    }

    // Helper methods
    calculateDiscountedPrice(product, discountPercent) {
        const basePrice = parseFloat(product.price || product.basePrice || 0);
        return basePrice * (1 - (discountPercent / 100));
    }

    calculateExpirationDate(days) {
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + days);
        return expiration.toISOString();
    }

    async makeShopifyRequest(method, endpoint, data = null) {
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': this.shopify.accessToken
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Shopify API error: ${response.status} - ${error}`);
        }

        return await response.json();
    }

    // Track conversion (check if draft order became real order)
    async checkConversion(draftOrderId) {
        try {
            const response = await this.makeShopifyRequest('GET', `/admin/api/2024-07/draft_orders/${draftOrderId}.json`);
            const draftOrder = response.draft_order;
            
            return {
                isCompleted: draftOrder.status === 'completed',
                orderId: draftOrder.order_id,
                completedAt: draftOrder.completed_at,
                totalPaid: draftOrder.total_price,
                status: draftOrder.status
            };
        } catch (error) {
            console.error('Failed to check conversion:', error);
            return null;
        }
    }
}

// Express routes
router.post('/create-draft-order', async (req, res) => {
    try {
        const { priceListData } = req.body;
        
        if (!priceListData || !priceListData.products?.length) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid price list data' 
            });
        }

        const draftOrderManager = new DraftOrderManager({
            shop: process.env.SHOPIFY_SHOP_NAME,
            accessToken: process.env.SHOPIFY_ACCESS_TOKEN
        });

        const draftOrder = await draftOrderManager.createDraftOrder(priceListData);
        const qrData = draftOrderManager.generateQRData(draftOrder, priceListData);

        res.json({
            success: true,
            draftOrder: {
                id: draftOrder.id,
                checkoutURL: draftOrder.invoice_url,
                totalPrice: draftOrder.total_price,
                itemCount: draftOrder.line_items.length
            },
            qrData,
            message: 'Draft order created successfully'
        });

    } catch (error) {
        console.error('Draft order creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/create-cart-permalink', async (req, res) => {
    try {
        const { products, discountCode } = req.body;
        
        if (!products?.length) {
            return res.status(400).json({ 
                success: false, 
                error: 'No products provided' 
            });
        }

        const draftOrderManager = new DraftOrderManager({
            shop: process.env.SHOPIFY_SHOP_NAME,
            accessToken: process.env.SHOPIFY_ACCESS_TOKEN
        });

        const cartURL = draftOrderManager.createCartPermalink(products, discountCode);

        res.json({
            success: true,
            cartURL,
            message: 'Cart permalink created successfully'
        });

    } catch (error) {
        console.error('Cart permalink creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/check-conversion/:draftOrderId', async (req, res) => {
    try {
        const { draftOrderId } = req.params;

        const draftOrderManager = new DraftOrderManager({
            shop: process.env.SHOPIFY_SHOP_NAME,
            accessToken: process.env.SHOPIFY_ACCESS_TOKEN
        });

        const conversion = await draftOrderManager.checkConversion(draftOrderId);

        res.json({
            success: true,
            conversion
        });

    } catch (error) {
        console.error('Conversion check error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
export { DraftOrderManager };
