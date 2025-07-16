// src/index.js - Complete Corrected Version
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import session from 'express-session';
import { shopifyApi } from '@shopify/shopify-api';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Import draft orders router and QR code functionality
import draftOrdersRouter, { DraftOrderManager } from './draft-orders.js';
import QRCode from 'qrcode';

dotenv.config();

// ===========================================
// SHOPIFY SERVICE CLASS (EMBEDDED)
// ===========================================
class ShopifyService {
  constructor() {
    this.shopDomain = process.env.SHOPIFY_SHOP_NAME || 'cycle1-test.myshopify.com';
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = '2024-07';
  }

  // Make GraphQL request to Shopify
  async graphqlRequest(query, variables = {}) {
    const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  // Get products with full details (FIXED QUERY)
  async getProducts(limit = 50, cursor = null) {
    const query = `
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after, query: "status:active") {
          edges {
            node {
              id
              title
              handle
              description
              productType
              vendor
              tags
              status
              createdAt
              updatedAt
              featuredImage {
                url
                altText
                width
                height
              }
              images(first: 5) {
                edges {
                  node {
                    url
                    altText
                    width
                    height
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    compareAtPrice
                    sku
                    barcode
                    inventoryQuantity
                    availableForSale
                    taxable
                  }
                }
              }
              options {
                id
                name
                values
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const result = await this.graphqlRequest(query, {
      first: limit,
      after: cursor
    });

    // Transform the data to a cleaner format
    const products = result.products.edges.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description,
      productType: edge.node.productType || 'Uncategorized',
      vendor: edge.node.vendor || 'Unknown Vendor',
      tags: edge.node.tags,
      status: edge.node.status,
      featuredImage: edge.node.featuredImage,
      images: edge.node.images.edges.map(img => img.node),
      variants: edge.node.variants.edges.map(variant => ({
        id: variant.node.id,
        title: variant.node.title,
        price: parseFloat(variant.node.price || '0'),
        compareAtPrice: variant.node.compareAtPrice ? parseFloat(variant.node.compareAtPrice) : null,
        sku: variant.node.sku,
        barcode: variant.node.barcode,
        inventoryQuantity: variant.node.inventoryQuantity || 0,
        availableForSale: variant.node.availableForSale,
        taxable: variant.node.taxable
      })),
      options: edge.node.options
    }));

    return {
      products,
      pageInfo: result.products.pageInfo,
      hasNextPage: result.products.pageInfo.hasNextPage,
      endCursor: result.products.pageInfo.endCursor
    };
  }

  // Get shop information
  async getShopInfo() {
    const query = `
      query getShop {
        shop {
          id
          name
          email
          phone
          myshopifyDomain
          primaryDomain {
            url
            host
          }
          plan {
            displayName
            partnerDevelopment
            shopifyPlus
          }
          billingAddress {
            address1
            address2
            city
            province
            country
            zip
          }
          currencyCode
          currencyFormats {
            moneyFormat
            moneyWithCurrencyFormat
          }
          timezone
          ianaTimezone
        }
      }
    `;

    const result = await this.graphqlRequest(query);
    return result.shop;
  }

  // Search products
  async searchProducts(searchTerm, limit = 50) {
    const query = `
      query searchProducts($query: String!, $first: Int!) {
        products(query: $query, first: $first) {
          edges {
            node {
              id
              title
              handle
              productType
              vendor
              tags
              featuredImage {
                url
                altText
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                    sku
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }
      }
    `;

    const searchQuery = `title:*${searchTerm}* OR vendor:*${searchTerm}* OR product_type:*${searchTerm}* AND status:active`;
    
    const result = await this.graphqlRequest(query, {
      query: searchQuery,
      first: limit
    });

    return result.products.edges.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      productType: edge.node.productType || 'Uncategorized',
      vendor: edge.node.vendor || 'Unknown Vendor',
      tags: edge.node.tags,
      featuredImage: edge.node.featuredImage,
      variants: edge.node.variants.edges.map(variant => ({
        id: variant.node.id,
        price: parseFloat(variant.node.price || '0'),
        sku: variant.node.sku,
        inventoryQuantity: variant.node.inventoryQuantity || 0
      }))
    }));
  }

  // Test connection
  async testConnection() {
    try {
      const shop = await this.getShopInfo();
      return {
        success: true,
        shop: shop,
        message: `Successfully connected to ${shop.name}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to connect to Shopify'
      };
    }
  }

  // Check if properly configured
  isConfigured() {
    return !!(this.shopDomain && this.accessToken);
  }
}

// Create Shopify service instance
const shopifyService = new ShopifyService();

// ===========================================
// FLEXIBLE PRICING FUNCTIONS
// ===========================================

// Flexible pricing calculator - user-defined discounts
function calculateFlexiblePricing(basePrice, tierConfig) {
  // tierConfig example: { discountPercent: 15, customPrices: { productId: customPrice } }
  const discountMultiplier = (100 - (tierConfig.discountPercent || 0)) / 100;
  return parseFloat(basePrice) * discountMultiplier;
}

// ===========================================
// MIDDLEWARE SETUP  
// ===========================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
const publicPath = path.join(process.cwd(), 'public');
app.use('/static', express.static(publicPath));
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
}));

// ===========================================
// API ROUTES
// ===========================================

// Mount draft orders router
app.use('/api/draft-orders', draftOrdersRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'Price List Generator API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    shopifyConfigured: shopifyService.isConfigured()
  });
});

// Enhanced debug endpoint for Shopify connection
app.get('/api/shopify/debug', async (req, res) => {
  try {
    console.log('🔍 DEBUGGING SHOPIFY CONNECTION...');
    
    // Check environment variables
    const envCheck = {
      SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
      SHOPIFY_ACCESS_TOKEN: !!process.env.SHOPIFY_ACCESS_TOKEN,
      SHOPIFY_SHOP_NAME: !!process.env.SHOPIFY_SHOP_NAME,
      shopDomain: process.env.SHOPIFY_SHOP_NAME,
      tokenFormat: process.env.SHOPIFY_ACCESS_TOKEN ? process.env.SHOPIFY_ACCESS_TOKEN.substring(0, 10) + '...' : 'missing'
    };
    
    console.log('📋 Environment Check:', envCheck);
    
    if (!shopifyService.isConfigured()) {
      return res.json({
        success: false,
        message: 'Shopify not configured',
        debug: envCheck,
        error: 'Missing required environment variables'
      });
    }
    
    // Test basic API call
    const url = `https://${shopifyService.shopDomain}/admin/api/${shopifyService.apiVersion}/graphql.json`;
    console.log('🔗 Testing URL:', url);
    
    const testQuery = `query { shop { name id } }`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyService.accessToken
      },
      body: JSON.stringify({
        query: testQuery
      })
    });
    
    console.log('📡 Response Status:', response.status);
    
    const responseText = await response.text();
    console.log('📡 Response Body:', responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText, parseError: e.message };
    }
    
    if (!response.ok) {
      return res.json({
        success: false,
        message: `HTTP ${response.status}: ${response.statusText}`,
        debug: {
          ...envCheck,
          url: url,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseData
        }
      });
    }
    
    if (responseData.errors) {
      return res.json({
        success: false,
        message: 'GraphQL Errors',
        debug: {
          ...envCheck,
          url: url,
          graphqlErrors: responseData.errors,
          responseBody: responseData
        }
      });
    }
    
    // Success
    res.json({
      success: true,
      message: 'Shopify connection successful!',
      shop: responseData.data?.shop,
      debug: {
        ...envCheck,
        url: url,
        responseStatus: response.status
      }
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: error.message,
      stack: error.stack
    });
  }
});

// Real Shopify products endpoint with fallback
app.get('/api/shopify/products', async (req, res) => {
  try {
    console.log('🛍️ Fetching products from Shopify...');
    
    // Check if Shopify is configured
    if (!shopifyService.isConfigured()) {
      console.log('⚠️ Shopify not configured, using mock data');
      
      // Return mock data if Shopify not configured
      const mockProducts = [
        {
          id: 'gid://shopify/Product/1',
          title: 'Sunsynk Wall Mount 5.12kWh 51.2V Lithium Battery',
          vendor: 'Sunsynk',
          productType: 'Battery',
          featuredImage: { url: 'https://via.placeholder.com/150x150?text=Battery' },
          variants: [{ 
            id: 'gid://shopify/ProductVariant/1',
            price: 19999.00,
            sku: 'SUN-BATT-5.12',
            inventoryQuantity: 5
          }]
        },
        {
          id: 'gid://shopify/Product/2', 
          title: '5.12kWh Dyness 51.2V Battery BX51100',
          vendor: 'Dyness',
          productType: 'Battery',
          featuredImage: { url: 'https://via.placeholder.com/150x150?text=Dyness' },
          variants: [{
            id: 'gid://shopify/ProductVariant/2',
            price: 16100.00, 
            sku: 'BX51100',
            inventoryQuantity: 3
          }]
        },
        {
          id: 'gid://shopify/Product/3',
          title: 'Esener 25.6V 100Ah Multifunctional Lithium Battery',
          vendor: 'Esener', 
          productType: 'Battery',
          featuredImage: { url: 'https://via.placeholder.com/150x150?text=Esener' },
          variants: [{
            id: 'gid://shopify/ProductVariant/3',
            price: 9200.00,
            sku: 'ES-2.56KWH',
            inventoryQuantity: 10
          }]
        }
      ];

      return res.json({
        success: true,
        products: mockProducts,
        count: mockProducts.length,
        message: 'Mock products loaded (configure Shopify to load real products)',
        source: 'mock'
      });
    }

    // Parse query parameters
    const limit = Math.min(parseInt(req.query.limit) || 50, 250);
    const cursor = req.query.cursor || null;
    const search = req.query.search || null;

    let result;

    if (search) {
      console.log(`🔍 Searching products for: "${search}"`);
      const products = await shopifyService.searchProducts(search, limit);
      result = {
        products: products,
        hasNextPage: false,
        endCursor: null
      };
    } else {
      console.log(`📦 Getting all products (limit: ${limit})`);
      result = await shopifyService.getProducts(limit, cursor);
    }

    console.log(`✅ Successfully fetched ${result.products.length} products from Shopify`);

    res.json({
      success: true,
      products: result.products,
      count: result.products.length,
      hasNextPage: result.hasNextPage,
      endCursor: result.endCursor,
      message: `Loaded ${result.products.length} products from Shopify`,
      source: 'shopify'
    });

  } catch (error) {
    console.error('❌ Error fetching Shopify products:', error);
    
    // Return helpful error message
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch products from Shopify',
      error: error.message,
      hint: 'Check your SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_NAME environment variables'
    });
  }
});

// Get shop information endpoint
app.get('/api/shopify/shop', async (req, res) => {
  try {
    if (!shopifyService.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Shopify not configured'
      });
    }

    const shop = await shopifyService.getShopInfo();
    
    res.json({
      success: true,
      shop: shop,
      message: 'Shop information retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Error fetching shop info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shop information',
      error: error.message
    });
  }
});

// Test Shopify connection endpoint
app.get('/api/shopify/test', async (req, res) => {
  try {
    const connectionTest = await shopifyService.testConnection();
    
    if (connectionTest.success) {
      res.json({
        success: true,
        message: connectionTest.message,
        shop: connectionTest.shop
      });
    } else {
      res.status(500).json({
        success: false,
        message: connectionTest.message,
        error: connectionTest.error
      });
    }

  } catch (error) {
    console.error('❌ Shopify connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Connection test failed',
      error: error.message
    });
  }
});

// Enhanced PDF generation with QR codes, clickable links, and professional layout
app.post('/api/price-lists/generate-pdf-with-qr', async (req, res) => {
  try {
    const { 
      title, 
      currency, 
      products, 
      company, 
      pricingConfig = {},
      customPrices = {},
      clientInfo = {},
      includeQR = true
    } = req.body;
    
    console.log('📄 Generating enhanced PDF with QR codes');
    
    // Import jsPDF
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
    const doc = new jsPDF();
    
    // Create draft order and QR code if requested
    let qrCodeDataURL = null;
    let draftOrderInfo = null;
    
    if (includeQR && products && products.length > 0) {
      try {
        const draftOrderManager = new DraftOrderManager({
          shop: process.env.SHOPIFY_SHOP_NAME,
          accessToken: process.env.SHOPIFY_ACCESS_TOKEN
        });

        const priceListData = {
          products: products.map(product => ({
            ...product,
            quantity: 1,
            pricing: {
              finalPrice: customPrices[product.id] !== undefined 
                ? parseFloat(customPrices[product.id])
                : (product.variants[0]?.price || 0) * (1 - (pricingConfig.discountPercent || 0) / 100)
            }
          })),
          clientName: clientInfo.name || 'Customer',
          clientEmail: clientInfo.email || 'customer@example.com',
          pricingTier: pricingConfig.tierName || 'retail',
          listId: `PL-${Date.now()}`,
          discount: pricingConfig.discountPercent || 0
        };

        const draftOrder = await draftOrderManager.createDraftOrder(priceListData);
        qrCodeDataURL = await draftOrderManager.generateQRCodeImage(draftOrder.invoice_url);
        draftOrderInfo = {
          id: draftOrder.id,
          checkoutURL: draftOrder.invoice_url,
          totalPrice: draftOrder.total_price,
          itemCount: draftOrder.line_items.length
        };
        
        console.log('✅ Draft order created with QR code');
      } catch (qrError) {
        console.warn('⚠️ QR code generation failed, proceeding without QR:', qrError.message);
      }
    }

    // Header with company branding
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(44, 62, 80); // Dark blue-gray
    doc.text(company?.name || 'Your Company', 20, 30);
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(52, 73, 94);
    doc.text(title || 'Custom Price List', 20, 45);
    
    doc.setFontSize(10);
    doc.setTextColor(127, 140, 141);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 55);
    
    // Add QR code if available
    if (qrCodeDataURL) {
      doc.addImage(qrCodeDataURL, 'PNG', 140, 20, 45, 45);
      doc.setFontSize(8);
      doc.setTextColor(52, 73, 94);
      doc.text('Scan to order instantly', 145, 72);
      doc.text(`Total: R ${draftOrderInfo.totalPrice}`, 145, 80);
    }
    
    // Show pricing tier info
    let yPos = qrCodeDataURL ? 90 : 65;
    if (pricingConfig.tierName) {
      doc.setFontSize(10);
      doc.setTextColor(44, 62, 80);
      doc.text(`Pricing Tier: ${pricingConfig.tierName}`, 20, yPos);
      yPos += 8;
    }
    if (pricingConfig.discountPercent) {
      doc.text(`Base Discount: ${pricingConfig.discountPercent}%`, 20, yPos);
      yPos += 8;
    }
    
    // Client information section
    if (clientInfo.name || clientInfo.email) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(44, 62, 80);
      doc.text('CLIENT INFORMATION', 20, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      if (clientInfo.name) {
        doc.text(`Name: ${clientInfo.name}`, 20, yPos);
        yPos += 6;
      }
      if (clientInfo.email) {
        doc.text(`Email: ${clientInfo.email}`, 20, yPos);
        yPos += 6;
      }
      yPos += 5;
    }
    
    // Company contact info
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('COMPANY INFORMATION', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    if (company?.email) {
      doc.text(`Email: ${company.email}`, 20, yPos);
      yPos += 6;
    }
    if (company?.phone) {
      doc.text(`Phone: ${company.phone}`, 20, yPos);
      yPos += 6;
    }
    if (company?.website) {
      doc.text(`Website: ${company.website}`, 20, yPos);
      yPos += 6;
    }
    
    yPos += 10;
    
    // Enhanced table
    const tableColumns = [
      { header: 'Product Name', dataKey: 'name' },
      { header: 'Model/SKU', dataKey: 'sku' },
      { header: 'Base Price', dataKey: 'basePrice' },
      { header: 'Your Price', dataKey: 'finalPrice' },
      { header: 'Savings', dataKey: 'savings' }
    ];
    
    const tableRows = (products || []).map(product => {
      const variant = product.variants && product.variants[0] ? product.variants[0] : {};
      const basePrice = variant.price || 0;
      
      const hasCustomPrice = customPrices[product.id] !== undefined;
      let finalPrice;
      
      if (hasCustomPrice) {
        finalPrice = parseFloat(customPrices[product.id]);
      } else {
        const discountMultiplier = (100 - (pricingConfig.discountPercent || 0)) / 100;
        finalPrice = basePrice * discountMultiplier;
      }
      
      const savings = basePrice - finalPrice;
      const savingsPercent = basePrice > 0 ? ((savings / basePrice) * 100).toFixed(1) : '0';
      
      return {
        name: product.title || 'Unknown Product',
        sku: variant.sku || 'N/A',
        basePrice: `R ${basePrice.toFixed(2)}`,
        finalPrice: `R ${finalPrice.toFixed(2)}` + (hasCustomPrice ? ' *' : ''),
        savings: savings > 0 ? `-${savingsPercent}%` : '0%',
        productId: product.id,
        productHandle: product.handle,
        productUrl: company?.website ? `${company.website}/products/${product.handle || product.id}` : null
      };
    });
    
    // Generate table
    doc.autoTable({
      columns: tableColumns,
      body: tableRows,
      startY: yPos,
      theme: 'striped',
      styles: { 
        fontSize: 9, 
        cellPadding: 4,
        textColor: [44, 62, 80],
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [52, 152, 219], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 25, halign: 'right', fillColor: [240, 248, 255] },
        4: { cellWidth: 20, halign: 'center' }
      },
      didDrawCell: (data) => {
        if (data.column.dataKey === 'name' && data.cell.section === 'body') {
          const rowData = tableRows[data.row.index];
          if (rowData.productUrl) {
            doc.link(
              data.cell.x, 
              data.cell.y, 
              data.cell.width, 
              data.cell.height, 
              { url: rowData.productUrl }
            );
          }
        }
      }
    });
    
    // Enhanced footer
    const pageHeight = doc.internal.pageSize.height;
    let footerY = pageHeight - 60;
    
    doc.setFontSize(10);
    doc.setTextColor(44, 62, 80);
    
    if (qrCodeDataURL) {
      doc.setFont(undefined, 'bold');
      doc.text('🔥 INSTANT ORDERING', 20, footerY);
      footerY += 8;
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.text('1. Scan the QR code above with your phone', 20, footerY);
      footerY += 6;
      doc.text('2. Review your personalized order', 20, footerY);
      footerY += 6;
      doc.text('3. Complete checkout instantly', 20, footerY);
      footerY += 10;
    }
    
    doc.setFontSize(8);
    doc.setTextColor(127, 140, 141);
    
    if (Object.keys(customPrices).length > 0) {
      doc.text('* Custom pricing applied for specific products', 20, footerY);
      footerY += 6;
    }
    
    if (company?.website) {
      doc.text('Product names are clickable links to our online store', 20, footerY);
      footerY += 6;
    }
    
    if (pricingConfig.notes) {
      doc.text(`Notes: ${pricingConfig.notes}`, 20, footerY);
      footerY += 6;
    }
    
    if (company?.terms) {
      doc.text(`Terms: ${company.terms}`, 20, footerY);
      footerY += 6;
    }
    
    // Footer line
    doc.setDrawColor(189, 195, 199);
    doc.setLineWidth(0.5);
    doc.line(20, pageHeight - 15, 190, pageHeight - 15);
    
    // Generation info
    doc.setFontSize(7);
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 
      20, 
      pageHeight - 8
    );
    
    const pdfBuffer = doc.output('arraybuffer');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="price-list-with-qr-${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.byteLength);
    res.end(Buffer.from(pdfBuffer));
    
    console.log('✅ Enhanced PDF with QR code generated successfully');
    
  } catch (error) {
    console.error('❌ Enhanced PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Enhanced PDF generation failed',
      error: error.message
    });
  }
});

// Enhanced PDF generation with FIXED characters, full names, and clickable links (original endpoint)
app.post('/api/price-lists/generate-pdf-flexible', async (req, res) => {
  try {
    const { 
      title, 
      currency, 
      products, 
      company, 
      pricingConfig = {},
      customPrices = {} 
    } = req.body;
    
    console.log('📄 Generating enhanced PDF with clickable links');
    
    // Import jsPDF
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
    const doc = new jsPDF();
    
    // Header with company branding
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(44, 62, 80); // Dark blue-gray
    doc.text(company?.name || 'Your Company', 20, 30);
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(52, 73, 94);
    doc.text(title || 'Custom Price List', 20, 45);
    
    doc.setFontSize(10);
    doc.setTextColor(127, 140, 141);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 55);
    
    // Show pricing tier info on the right
    if (pricingConfig.tierName) {
      doc.text(`Pricing Tier: ${pricingConfig.tierName}`, 120, 55);
    }
    if (pricingConfig.discountPercent) {
      doc.text(`Base Discount: ${pricingConfig.discountPercent}%`, 120, 65);
    }
    
    // Company contact info - FIXED: No more random characters!
    let yPos = 75;
    doc.setFontSize(10);
    doc.setTextColor(44, 62, 80);
    
    if (company?.email) {
      doc.text(`Email: ${company.email}`, 20, yPos);
      yPos += 8;
    }
    if (company?.phone) {
      doc.text(`Phone: ${company.phone}`, 120, yPos - 8); // Place phone on the right
    }
    if (company?.website) {
      doc.text(`Website: ${company.website}`, 20, yPos);
      yPos += 15;
    }
    
    // Table with enhanced formatting
    const tableColumns = [
      { header: 'Product Name', dataKey: 'name' },
      { header: 'Vendor', dataKey: 'vendor' },
      { header: 'Base Price', dataKey: 'basePrice' },
      { header: 'Your Price', dataKey: 'finalPrice' },
      { header: 'Savings', dataKey: 'savings' },
      { header: 'Stock', dataKey: 'stock' }
    ];
    
    const tableRows = (products || []).map(product => {
      const variant = product.variants && product.variants[0] ? product.variants[0] : {};
      const basePrice = variant.price || 0;
      
      // Check for custom pricing
      const hasCustomPrice = customPrices[product.id] !== undefined;
      let finalPrice;
      
      if (hasCustomPrice) {
        finalPrice = parseFloat(customPrices[product.id]);
      } else {
        const discountMultiplier = (100 - (pricingConfig.discountPercent || 0)) / 100;
        finalPrice = basePrice * discountMultiplier;
      }
      
      const savings = basePrice - finalPrice;
      const savingsPercent = basePrice > 0 ? ((savings / basePrice) * 100).toFixed(1) : '0';
      
      return {
        name: product.title || 'Unknown Product', // FIXED: Full product name!
        vendor: product.vendor || 'Unknown',
        basePrice: `R ${basePrice.toFixed(2)}`,
        finalPrice: `R ${finalPrice.toFixed(2)}` + (hasCustomPrice ? ' *' : ''),
        savings: savings > 0 ? `-${savingsPercent}%` : '0%',
        stock: variant.inventoryQuantity > 0 ? 'Available' : 'Out of Stock',
        // Store product data for links
        productId: product.id,
        productHandle: product.handle,
        productUrl: company?.website ? `${company.website}/products/${product.handle || product.id}` : null
      };
    });
    
    // Enhanced table with clickable product links
    doc.autoTable({
      columns: tableColumns,
      body: tableRows,
      startY: yPos,
      theme: 'striped',
      styles: { 
        fontSize: 8, 
        cellPadding: 4,
        textColor: [44, 62, 80],
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [52, 152, 219], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      columnStyles: {
        0: { cellWidth: 60 }, // Product name - wider for full names
        1: { cellWidth: 25 }, // Vendor
        2: { cellWidth: 25, halign: 'right' }, // Base price
        3: { cellWidth: 25, halign: 'right', fillColor: [240, 248, 255] }, // Final price
        4: { cellWidth: 20, halign: 'center' }, // Savings
        5: { cellWidth: 20, halign: 'center' } // Stock
      },
      didDrawCell: (data) => {
        // FIXED: Add clickable links for product names!
        if (data.column.dataKey === 'name' && data.cell.section === 'body') {
          const rowData = tableRows[data.row.index];
          if (rowData.productUrl) {
            // Add clickable link
            doc.link(
              data.cell.x, 
              data.cell.y, 
              data.cell.width, 
              data.cell.height, 
              { url: rowData.productUrl }
            );
            
            // Add subtle visual indicator for clickable area
            doc.setDrawColor(52, 152, 219);
            doc.setLineWidth(0.2);
            doc.line(
              data.cell.x + 2, 
              data.cell.y + data.cell.height - 1, 
              data.cell.x + data.cell.width - 2, 
              data.cell.y + data.cell.height - 1
            );
          }
        }
      }
    });
    
    // Enhanced footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(127, 140, 141);
    
    let footerY = pageHeight - 40;
    
    // Legend for custom pricing
    doc.text('* Custom pricing applied for specific products', 20, footerY);
    footerY += 8;
    
    // Clickable products note
    if (company?.website) {
      doc.text('Click product names to visit our online store', 20, footerY);
      footerY += 8;
    }
    
    // Configuration notes
    if (pricingConfig.notes) {
      doc.text(`Notes: ${pricingConfig.notes}`, 20, footerY);
      footerY += 8;
    }
    
    // Terms and conditions
    if (company?.terms) {
      doc.text(`Terms: ${company.terms}`, 20, footerY);
    }
    
    // Add footer line
    doc.setDrawColor(189, 195, 199);
    doc.setLineWidth(0.5);
    doc.line(20, pageHeight - 15, 190, pageHeight - 15);
    
    // Generation info
    doc.setFontSize(7);
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 
      20, 
      pageHeight - 8
    );
    
    const pdfBuffer = doc.output('arraybuffer');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="enhanced-price-list-${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.byteLength);
    res.end(Buffer.from(pdfBuffer));
    
    console.log('✅ Enhanced PDF with clickable links generated successfully');
    
  } catch (error) {
    console.error('❌ Enhanced PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Enhanced PDF generation failed',
      error: error.message
    });
  }
});
// API endpoint to save pricing configurations
app.post('/api/pricing-configs/save', async (req, res) => {
  try {
    const { 
      configName, 
      tierName, 
      discountPercent, 
      customPrices, 
      notes,
      shopDomain 
    } = req.body;
    
    // In a real app, you'd save this to a database
    // For now, we'll just return the config
    const pricingConfig = {
      id: Date.now(),
      configName: configName || `${tierName} Pricing`,
      tierName,
      discountPercent: parseFloat(discountPercent) || 0,
      customPrices: customPrices || {},
      notes: notes || '',
      shopDomain,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('💾 Saving pricing config:', pricingConfig.configName);
    
    res.json({
      success: true,
      message: 'Pricing configuration saved successfully',
      config: pricingConfig
    });
    
  } catch (error) {
    console.error('❌ Error saving pricing config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save pricing configuration',
      error: error.message
    });
  }
});

// API endpoint to load saved pricing configurations
app.get('/api/pricing-configs', async (req, res) => {
  try {
    const { shopDomain } = req.query;
    
    // In a real app, you'd fetch from database
    // For now, return sample configs
    const sampleConfigs = [
      {
        id: 1,
        configName: 'Standard Wholesale',
        tierName: 'Wholesale',
        discountPercent: 15,
        customPrices: {},
        notes: 'Standard wholesale pricing for regular customers'
      },
      {
        id: 2,
        configName: 'Premium Installer',
        tierName: 'Installer',
        discountPercent: 25,
        customPrices: {},
        notes: 'Premium pricing for high-volume installers'
      },
      {
        id: 3,
        configName: 'VIP Distributor',
        tierName: 'Distributor',
        discountPercent: 30,
        customPrices: {},
        notes: 'Special pricing for key distribution partners'
      }
    ];
    
    res.json({
      success: true,
      configs: sampleConfigs,
      message: 'Pricing configurations loaded'
    });
    
  } catch (error) {
    console.error('❌ Error loading pricing configs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load pricing configurations',
      error: error.message
    });
  }
});

// API endpoint for real-time price calculation
app.post('/api/calculate-pricing', async (req, res) => {
  try {
    const { products, pricingConfig, customPrices = {} } = req.body;
    
    const calculatedProducts = products.map(product => {
      const variant = product.variants && product.variants[0] ? product.variants[0] : {};
      const basePrice = variant.price || 0;
      
      let finalPrice;
      let priceSource;
      
      if (customPrices[product.id] !== undefined) {
        finalPrice = parseFloat(customPrices[product.id]);
        priceSource = 'custom';
      } else {
        finalPrice = calculateFlexiblePricing(basePrice, pricingConfig);
        priceSource = 'tier';
      }
      
      const savings = basePrice - finalPrice;
      const savingsPercent = basePrice > 0 ? ((savings / basePrice) * 100) : 0;
      
      return {
        ...product,
        pricing: {
          basePrice,
          finalPrice,
          savings,
          savingsPercent: parseFloat(savingsPercent.toFixed(2)),
          priceSource
        }
      };
    });
    
    res.json({
      success: true,
      products: calculatedProducts,
      summary: {
        totalProducts: calculatedProducts.length,
        customPriced: calculatedProducts.filter(p => p.pricing.priceSource === 'custom').length,
        tierPriced: calculatedProducts.filter(p => p.pricing.priceSource === 'tier').length,
        averageSavings: calculatedProducts.reduce((acc, p) => acc + p.pricing.savingsPercent, 0) / calculatedProducts.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error calculating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate pricing',
      error: error.message
    });
  }
});

// ===========================================
// PRICE LIST STORAGE ENDPOINTS
// ===========================================

// Save price list
app.post('/api/price-lists/save', async (req, res) => {
  try {
    const priceListData = req.body;
    
    if (!priceListData.name || !priceListData.products || priceListData.products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name and products are required'
      });
    }

    // Generate unique ID
    const id = `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced price list data
    const savedPriceList = {
      id,
      ...priceListData,
      savedAt: new Date().toISOString(),
      status: 'active'
    };

    // In a real app, you'd save to database
    // For now, we'll simulate saving and return success
    console.log('💾 Saving price list:', savedPriceList.name);
    
    res.json({
      success: true,
      message: 'Price list saved successfully',
      priceList: {
        id: savedPriceList.id,
        name: savedPriceList.name,
        totalProducts: savedPriceList.totalProducts,
        totalValue: savedPriceList.totalValue,
        pricingTier: savedPriceList.pricingConfig.tierName,
        createdAt: savedPriceList.createdAt,
        savedAt: savedPriceList.savedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error saving price list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save price list',
      error: error.message
    });
  }
});

// Get all saved price lists
app.get('/api/price-lists', async (req, res) => {
  try {
    // In a real app, you'd fetch from database
    // For now, return sample data
    const samplePriceLists = [
      {
        id: 'pl_1704067200000_abc123',
        name: 'Wholesale Battery Price List',
        totalProducts: 5,
        totalValue: 85000,
        pricingTier: 'wholesale',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        savedAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'active'
      },
      {
        id: 'pl_1704153600000_def456',
        name: 'Installer Solar Kit Pricing',
        totalProducts: 8,
        totalValue: 125000,
        pricingTier: 'installer',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        savedAt: new Date(Date.now() - 172800000).toISOString(),
        status: 'active'
      },
      {
        id: 'pl_1704240000000_ghi789',
        name: 'Retail Customer Quote',
        totalProducts: 3,
        totalValue: 45000,
        pricingTier: 'retail',
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        savedAt: new Date(Date.now() - 259200000).toISOString(),
        status: 'active'
      }
    ];
    
    res.json({
      success: true,
      priceLists: samplePriceLists,
      count: samplePriceLists.length,
      message: 'Price lists loaded successfully'
    });
    
  } catch (error) {
    console.error('❌ Error loading price lists:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load price lists',
      error: error.message
    });
  }
});

// Get specific price list
app.get('/api/price-lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // In a real app, you'd fetch from database
    // For now, return sample data
    const samplePriceList = {
      id: id,
      name: 'Sample Price List',
      products: [], // Would contain full product data
      company: {
        name: 'Your Company',
        email: 'sales@company.com',
        phone: '+27 11 123 4567',
        website: 'https://yourstore.com'
      },
      pricingConfig: {
        tierName: 'wholesale',
        discountPercent: 15,
        notes: ''
      },
      customPrices: {},
      createdAt: new Date().toISOString(),
      totalProducts: 0,
      totalValue: 0
    };
    
    res.json({
      success: true,
      priceList: samplePriceList,
      message: 'Price list loaded successfully'
    });
    
  } catch (error) {
    console.error('❌ Error loading price list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load price list',
      error: error.message
    });
  }
});

// Delete price list
app.delete('/api/price-lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // In a real app, you'd delete from database
    console.log('🗑️ Deleting price list:', id);
    
    res.json({
      success: true,
      message: 'Price list deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting price list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete price list',
      error: error.message
    });
  }
});

// ===========================================
// QR CODE GENERATION ENDPOINTS
// ===========================================

// Generate QR code for any URL
app.post('/api/generate-qr', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }

    // QR code generation options
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
    
    res.json({
      success: true,
      qrCodeDataURL,
      url,
      message: 'QR code generated successfully'
    });

  } catch (error) {
    console.error('❌ QR generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code',
      error: error.message
    });
  }
});

// Generate QR code and create draft order for price list
app.post('/api/generate-qr-with-draft-order', async (req, res) => {
  try {
    const { 
      products, 
      company, 
      pricingConfig, 
      customPrices = {},
      clientInfo = {} 
    } = req.body;
    
    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Products are required'
      });
    }

    // Create draft order manager
    const draftOrderManager = new DraftOrderManager({
      shop: process.env.SHOPIFY_SHOP_NAME,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN
    });

    // Prepare price list data for draft order
    const priceListData = {
      products: products.map(product => ({
        ...product,
        quantity: 1,
        pricing: {
          finalPrice: customPrices[product.id] !== undefined 
            ? parseFloat(customPrices[product.id])
            : (product.variants[0]?.price || 0) * (1 - (pricingConfig.discountPercent || 0) / 100)
        }
      })),
      clientName: clientInfo.name || 'Customer',
      clientEmail: clientInfo.email || 'customer@example.com',
      pricingTier: pricingConfig.tierName || 'retail',
      listId: `PL-${Date.now()}`,
      discount: pricingConfig.discountPercent || 0
    };

    // Create draft order
    const draftOrder = await draftOrderManager.createDraftOrder(priceListData);
    
    // Generate QR code for the checkout URL
    const qrCodeDataURL = await draftOrderManager.generateQRCodeImage(draftOrder.invoice_url);
    
    // Generate QR data
    const qrData = draftOrderManager.generateQRData(draftOrder, priceListData);

    res.json({
      success: true,
      draftOrder: {
        id: draftOrder.id,
        checkoutURL: draftOrder.invoice_url,
        totalPrice: draftOrder.total_price,
        itemCount: draftOrder.line_items.length
      },
      qrCodeDataURL,
      qrData,
      message: 'QR code and draft order created successfully'
    });

  } catch (error) {
    console.error('❌ QR + Draft Order generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code and draft order',
      error: error.message
    });
  }
});

// ===========================================
// FRONTEND ROUTES
// ===========================================

// Home page
app.get('/', (req, res) => {
  const homeHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Price List Generator</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 min-h-screen">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-4">
                    <div class="flex items-center space-x-4">
                        <h1 class="text-2xl font-bold text-gray-900">Price List Generator</h1>
                        <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                            APP STATUS: ONLINE
                        </span>
                    </div>
                    <nav class="hidden md:flex space-x-6">
                        <a href="/" class="text-blue-600 font-medium border-b-2 border-blue-600">Home</a>
                        <a href="/my-price-lists" class="text-gray-700 hover:text-blue-600 font-medium">My Price Lists</a>
                        <a href="/create-price-list" class="text-gray-700 hover:text-blue-600 font-medium">Create New</a>
                        <a href="/import-document" class="text-gray-700 hover:text-blue-600 font-medium">Import Document</a>
                        <a href="/templates" class="text-gray-700 hover:text-blue-600 font-medium">Templates</a>
                    </nav>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-12">
                <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-12 rounded-2xl mb-8">
                    <h2 class="text-4xl font-bold mb-4">Professional Price Lists Made Easy</h2>
                    <p class="text-xl mb-8">Create stunning, professional price lists from your Shopify products in minutes. Import existing documents or build from scratch.</p>
                    
                    <div class="flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="/create-price-list" class="bg-white text-blue-600 py-4 px-8 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center">
                            🚀 Create Price List
                        </a>
                        <a href="/import-document" class="bg-blue-500 text-white py-4 px-8 rounded-lg font-semibold hover:bg-blue-400 transition-colors flex items-center justify-center">
                            📄 Import Document
                        </a>
                    </div>
                </div>
            </div>

            <!-- Features Grid -->
            <div class="grid md:grid-cols-3 gap-8 mb-12">
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <div class="text-3xl mb-4">🏢</div>
                    <h3 class="text-xl font-semibold mb-2">Company Branding</h3>
                    <p class="text-gray-600">Add your logo, contact details, and terms to create professional branded price lists.</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <div class="text-3xl mb-4">🛍️</div>
                    <h3 class="text-xl font-semibold mb-2">Shopify Integration</h3>
                    <p class="text-gray-600">Automatically sync products, prices, and inventory from your Shopify store.</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <div class="text-3xl mb-4">📄</div>
                    <h3 class="text-xl font-semibold mb-2">PDF Export</h3>
                    <p class="text-gray-600">Generate beautiful, print-ready PDF catalogs that you can share with customers.</p>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="bg-white rounded-lg shadow-md p-8">
                <h3 class="text-2xl font-bold mb-6 text-center">Quick Actions</h3>
                <div class="grid sm:grid-cols-2 gap-4">
                    <a href="/my-price-lists" class="border-2 border-gray-200 hover:border-blue-300 rounded-lg p-6 text-center transition-colors">
                        <div class="text-2xl mb-2">📋</div>
                        <div class="font-semibold">My Price Lists</div>
                        <div class="text-sm text-gray-600">View and manage existing price lists</div>
                    </a>
                    <a href="/templates" class="border-2 border-gray-200 hover:border-blue-300 rounded-lg p-6 text-center transition-colors">
                        <div class="text-2xl mb-2">🎨</div>
                        <div class="font-semibold">Templates</div>
                        <div class="text-sm text-gray-600">Choose from professional templates</div>
                    </a>
                </div>
            </div>
        </main>

        <!-- Footer -->
        <footer class="bg-gray-800 text-white py-8 mt-16">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <p>&copy; 2025 Price List Generator. Professional catalogs made simple.</p>
            </div>
        </footer>
    </body>
    </html>
  `;
  
  res.send(homeHTML);
});

// Enhanced Create Price List Route
app.get('/create-price-list', (req, res) => {
  const createHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Create Price List - Price List Generator</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-4">
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-2xl font-bold text-gray-900">Price List Generator</a>
                        <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                            APP STATUS: ONLINE
                        </span>
                    </div>
                    <nav class="hidden md:flex space-x-6">
                        <a href="/" class="text-gray-700 hover:text-blue-600 font-medium">Home</a>
                        <a href="/my-price-lists" class="text-gray-700 hover:text-blue-600 font-medium">My Price Lists</a>
                        <a href="/create-price-list" class="text-blue-600 font-medium border-b-2 border-blue-600">Create New</a>
                    </nav>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900">Create New Price List</h1>
                <p class="mt-2 text-gray-600">Build professional price lists with flexible pricing for different customer tiers</p>
            </div>

            <!-- Status Messages -->
            <div id="statusMessages" class="mb-6"></div>

            <!-- Main Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Left Panel -->
                <div class="lg:col-span-1 space-y-6">
                    
                    <!-- Company Information -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h3 class="text-lg font-semibold mb-4">🏢 Company Information</h3>
                        <div class="space-y-4">
                            <input type="text" id="companyName" placeholder="Your Company Name" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <input type="email" id="companyEmail" placeholder="sales@company.com" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <input type="tel" id="companyPhone" placeholder="+27 11 123 4567" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <input type="url" id="companyWebsite" placeholder="https://yourstore.com" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                    </div>

                    <!-- Flexible Pricing -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h3 class="text-lg font-semibold mb-4">🎯 Flexible Pricing</h3>
                        
                        <!-- Tier Selection -->
                        <div class="grid grid-cols-1 gap-3 mb-4">
                            <div class="border rounded-lg p-3 cursor-pointer tier-option border-blue-500 bg-blue-50" data-tier="retail">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="font-medium">Retail</span>
                                    <input type="radio" name="tierType" value="retail" checked>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <span class="text-sm">Discount:</span>
                                    <input type="number" id="retailDiscount" min="0" max="100" step="0.1" value="0" class="w-16 px-2 py-1 border rounded text-sm discount-input">
                                    <span class="text-sm">%</span>
                                </div>
                            </div>
                            
                            <div class="border rounded-lg p-3 cursor-pointer tier-option border-gray-300" data-tier="wholesale">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="font-medium">Wholesale</span>
                                    <input type="radio" name="tierType" value="wholesale">
                                </div>
                                <div class="flex items-center space-x-2">
                                    <span class="text-sm">Discount:</span>
                                    <input type="number" id="wholesaleDiscount" min="0" max="100" step="0.1" value="15" class="w-16 px-2 py-1 border rounded text-sm discount-input">
                                    <span class="text-sm">%</span>
                                </div>
                            </div>
                            
                            <div class="border rounded-lg p-3 cursor-pointer tier-option border-gray-300" data-tier="installer">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="font-medium">Installer</span>
                                    <input type="radio" name="tierType" value="installer">
                                </div>
                                <div class="flex items-center space-x-2">
                                    <span class="text-sm">Discount:</span>
                                    <input type="number" id="installerDiscount" min="0" max="100" step="0.1" value="20" class="w-16 px-2 py-1 border rounded text-sm discount-input">
                                    <span class="text-sm">%</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Actions -->
                        <div class="space-y-2">
                            <button id="applyTierPricingBtn" class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                                Apply Tier Pricing
                            </button>
                        </div>
                    </div>

                    <!-- Connection & Actions -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div id="connectionStatus" class="p-4 rounded-lg bg-gray-50 mb-4">
                            <div class="text-sm">Shopify: <span id="connectionText">Not tested</span></div>
                        </div>
                        <div class="space-y-3">
                            <button id="testConnectionBtn" class="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700">
                                Test Connection
                            </button>
                            <button id="loadProductsBtn" class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                                Load Products
                            </button>
                            <button id="generateFlexiblePdfBtn" class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700" disabled>
                                📄 Generate PDF (Basic)
                            </button>
                            <button id="generateQRPdfBtn" class="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700" disabled>
                                🔥 Generate PDF with QR Code
                            </button>
                            <button id="savePriceListBtn" class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700" disabled>
                                💾 Save Price List
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Right Panel - Products -->
                <div class="lg:col-span-2">
                    <div class="bg-white rounded-lg shadow-md">
                        <!-- Search -->
                        <div class="p-6 border-b">
                            <div class="flex gap-4 mb-4">
                                <input type="text" id="searchProducts" placeholder="Search products..." class="flex-1 px-3 py-2 border rounded-md">
                                <button id="searchBtn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                    Search
                                </button>
                            </div>
                            <div class="flex gap-2">
                                <button id="selectAllBtn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">
                                    Select All
                                </button>
                                <button id="clearSelectionBtn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">
                                    Clear
                                </button>
                                <button id="resetAllPricesBtn" class="px-3 py-2 bg-yellow-100 text-yellow-700 rounded text-sm hover:bg-yellow-200">
                                    Reset Prices
                                </button>
                            </div>
                        </div>

                        <!-- Products -->
                        <div class="p-6">
                            <div id="loadingState" class="text-center py-12">
                                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p class="text-gray-600">Click "Load Products" to begin</p>
                            </div>
                            
                            <div id="productTableSection" class="hidden">
                                <div class="overflow-x-auto">
                                    <table class="w-full border-collapse text-sm">
                                        <thead class="bg-gray-50">
                                            <tr>
                                                <th class="px-3 py-2 text-left border">Select</th>
                                                <th class="px-3 py-2 text-left border">Product</th>
                                                <th class="px-3 py-2 text-left border">Base</th>
                                                <th class="px-3 py-2 text-left border">Tier</th>
                                                <th class="px-3 py-2 text-left border">Custom</th>
                                                <th class="px-3 py-2 text-left border">Final</th>
                                                <th class="px-3 py-2 text-left border">Save</th>
                                            </tr>
                                        </thead>
                                        <tbody id="enhancedProductList">
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <div id="pricingSummary" class="hidden mt-6 p-4 bg-blue-50 rounded-lg">
                                <h4 class="font-medium text-blue-900 mb-3">📊 Summary</h4>
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                    <div>Selected: <span id="summarySelectedCount" class="font-semibold">0</span></div>
                                    <div>Custom: <span id="summaryCustomCount" class="font-semibold">0</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <script>
            let state = {
                products: [],
                filteredProducts: [],
                selectedProducts: new Set(),
                selectedTier: 'retail',
                tierDiscounts: { retail: 0, wholesale: 15, installer: 20 },
                customPrices: {},
                calculatedProducts: []
            };

            const elements = {
                testConnectionBtn: document.getElementById('testConnectionBtn'),
                loadProductsBtn: document.getElementById('loadProductsBtn'),
                generateFlexiblePdfBtn: document.getElementById('generateFlexiblePdfBtn'),
                generateQRPdfBtn: document.getElementById('generateQRPdfBtn'),
                savePriceListBtn: document.getElementById('savePriceListBtn'),
                searchProducts: document.getElementById('searchProducts'),
                searchBtn: document.getElementById('searchBtn'),
                selectAllBtn: document.getElementById('selectAllBtn'),
                clearSelectionBtn: document.getElementById('clearSelectionBtn'),
                enhancedProductList: document.getElementById('enhancedProductList'),
                loadingState: document.getElementById('loadingState'),
                productTableSection: document.getElementById('productTableSection'),
                statusMessages: document.getElementById('statusMessages'),
                connectionText: document.getElementById('connectionText'),
                pricingSummary: document.getElementById('pricingSummary'),
                applyTierPricingBtn: document.getElementById('applyTierPricingBtn'),
                resetAllPricesBtn: document.getElementById('resetAllPricesBtn'),
                summarySelectedCount: document.getElementById('summarySelectedCount'),
                summaryCustomCount: document.getElementById('summaryCustomCount')
            };

            // Initialize tier selection
            document.querySelectorAll('.tier-option').forEach(option => {
                option.addEventListener('click', function() {
                    selectTier(this.dataset.tier);
                });
            });

            document.querySelectorAll('.discount-input').forEach(input => {
                input.addEventListener('change', function() {
                    const tier = this.id.replace('Discount', '');
                    state.tierDiscounts[tier] = parseFloat(this.value) || 0;
                    if (state.selectedTier === tier) {
                        recalculateAllPricing();
                    }
                });
            });

            function selectTier(tier) {
                state.selectedTier = tier;
                
                document.querySelectorAll('.tier-option').forEach(opt => {
                    opt.classList.remove('border-blue-500', 'bg-blue-50');
                    opt.classList.add('border-gray-300');
                });
                
                const selectedOption = document.querySelector(\`[data-tier="\${tier}"]\`);
                selectedOption.classList.add('border-blue-500', 'bg-blue-50');
                selectedOption.classList.remove('border-gray-300');
                
                document.querySelector(\`input[value="\${tier}"]\`).checked = true;
                
                const discountInput = document.getElementById(\`\${tier}Discount\`);
                state.tierDiscounts[tier] = parseFloat(discountInput.value) || 0;
                
                recalculateAllPricing();
            }

            // Event listeners
            elements.testConnectionBtn.addEventListener('click', async () => {
                const btn = elements.testConnectionBtn;
                btn.disabled = true;
                btn.textContent = 'Testing...';
                
                try {
                    const response = await fetch('/api/shopify/debug');
                    const data = await response.json();
                    
                    if (data.success) {
                        elements.connectionText.textContent = '✅ Connected to ' + data.shop.name;
                        showSuccess('Connected successfully!');
                    } else {
                        elements.connectionText.textContent = '❌ Failed';
                        showError('Connection failed: ' + data.message);
                    }
                } catch (error) {
                    elements.connectionText.textContent = '❌ Error';
                    showError('Connection test failed: ' + error.message);
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Test Connection';
                }
            });

            elements.loadProductsBtn.addEventListener('click', async () => {
                await loadProducts();
            });

            elements.applyTierPricingBtn.addEventListener('click', async () => {
                try {
                    const currentTier = state.selectedTier;
                    const discountInput = document.getElementById(\`\${currentTier}Discount\`);
                    const discountPercent = parseFloat(discountInput.value) || 0;
                    
                    state.tierDiscounts[currentTier] = discountPercent;
                    await recalculateAllPricing();
                    showSuccess(\`Applied \${discountPercent}% \${currentTier} discount\`);
                } catch (error) {
                    showError('Error applying tier pricing: ' + error.message);
                }
            });

            elements.resetAllPricesBtn.addEventListener('click', () => {
                state.customPrices = {};
                recalculateAllPricing();
                showSuccess('All prices reset to tier pricing');
            });

            elements.searchBtn.addEventListener('click', async () => {
                const searchTerm = elements.searchProducts.value.trim();
                await loadProducts(searchTerm);
            });

            elements.selectAllBtn.addEventListener('click', () => {
                const allSelected = state.filteredProducts.every(product => 
                    state.selectedProducts.has(product.id)
                );

                if (allSelected) {
                    state.filteredProducts.forEach(product => {
                        state.selectedProducts.delete(product.id);
                    });
                } else {
                    state.filteredProducts.forEach(product => {
                        state.selectedProducts.add(product.id);
                    });
                }
                
                renderEnhancedProductList();
                updatePricingSummary();
            });

            elements.clearSelectionBtn.addEventListener('click', () => {
                state.selectedProducts.clear();
                renderEnhancedProductList();
                updatePricingSummary();
            });

            elements.generateFlexiblePdfBtn.addEventListener('click', async () => {
                await generateFlexiblePDF();
            });

            elements.generateQRPdfBtn.addEventListener('click', async () => {
                await generateQRPDF();
            });

            elements.savePriceListBtn.addEventListener('click', async () => {
                await savePriceList();
            });

            async function loadProducts(searchTerm = null) {
                try {
                    showLoading('Loading products...');
                    elements.loadProductsBtn.disabled = true;
                    
                    let url = '/api/shopify/products?limit=50';
                    if (searchTerm) {
                        url += '&search=' + encodeURIComponent(searchTerm);
                    }
                    
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    if (data.success) {
                        state.products = data.products || [];
                        state.filteredProducts = [...state.products];
                        
                        await recalculateAllPricing();
                        
                        showSuccess('Loaded ' + state.products.length + ' products');
                        
                        if (data.source === 'mock') {
                            showInfo('Using mock data. Configure Shopify for real products.');
                        }
                    } else {
                        showError('Failed to load products: ' + data.message);
                    }
                } catch (error) {
                    showError('Error loading products: ' + error.message);
                } finally {
                    hideLoading();
                    elements.loadProductsBtn.disabled = false;
                }
            }

            async function recalculateAllPricing() {
                if (state.products.length === 0) return;
                
                try {
                    const currentTier = state.selectedTier;
                    const tierDiscount = state.tierDiscounts[currentTier] / 100;
                    
                    state.calculatedProducts = state.products.map(product => {
                        const variant = product.variants && product.variants[0] ? product.variants[0] : {};
                        const basePrice = variant.price || 0;
                        
                        let finalPrice;
                        let priceSource;
                        
                        if (state.customPrices[product.id] !== undefined) {
                            finalPrice = parseFloat(state.customPrices[product.id]);
                            priceSource = 'custom';
                        } else {
                            finalPrice = basePrice * (1 - tierDiscount);
                            priceSource = 'tier';
                        }
                        
                        const savings = basePrice - finalPrice;
                        const savingsPercent = basePrice > 0 ? ((savings / basePrice) * 100) : 0;
                        
                        return {
                            ...product,
                            pricing: {
                                basePrice,
                                finalPrice,
                                savings,
                                savingsPercent: parseFloat(savingsPercent.toFixed(2)),
                                priceSource
                            }
                        };
                    });
                    
                    state.filteredProducts = [...state.calculatedProducts];
                    renderEnhancedProductList();
                    updatePricingSummary();
                } catch (error) {
                    console.error('Error recalculating pricing:', error);
                }
            }

            function renderEnhancedProductList() {
                if (!elements.enhancedProductList) return;
                
                if (state.filteredProducts.length === 0) {
                    elements.enhancedProductList.innerHTML = '<tr><td colspan="7" class="text-center py-8">No products found</td></tr>';
                    elements.productTableSection.classList.remove('hidden');
                    elements.loadingState.classList.add('hidden');
                    return;
                }

                elements.enhancedProductList.innerHTML = state.filteredProducts.map(product => {
                    const variant = product.variants && product.variants[0] ? product.variants[0] : {};
                    const isSelected = state.selectedProducts.has(product.id);
                    const hasCustomPrice = state.customPrices[product.id] !== undefined;
                    const pricing = product.pricing || {};
                    
                    const tierPrice = pricing.basePrice * (1 - state.tierDiscounts[state.selectedTier] / 100);
                    
                    return \`
                        <tr class="hover:bg-gray-50 \${isSelected ? 'bg-blue-50' : ''}">
                            <td class="px-3 py-2 border">
                                <input type="checkbox" \${isSelected ? 'checked' : ''} 
                                       onchange="toggleProductSelection('\${product.id}')"
                                       class="rounded border-gray-300 text-blue-600">
                            </td>
                            <td class="px-3 py-2 border">
                                <div class="font-medium text-sm">\${product.title?.substring(0, 25) || 'Unknown'}</div>
                                <div class="text-xs text-gray-500">\${product.vendor || 'Unknown'}</div>
                            </td>
                            <td class="px-3 py-2 border text-xs">R \${(pricing.basePrice || 0).toFixed(2)}</td>
                            <td class="px-3 py-2 border text-xs">R \${tierPrice.toFixed(2)}</td>
                            <td class="px-3 py-2 border">
                                <input type="number" step="0.01" min="0" 
                                       value="\${hasCustomPrice ? state.customPrices[product.id].toFixed(2) : ''}"
                                       placeholder="Override"
                                       onchange="handleCustomPriceInput('\${product.id}', this.value)"
                                       class="w-16 px-1 py-1 border rounded text-xs \${hasCustomPrice ? 'border-blue-300 bg-blue-50' : ''}">
                            </td>
                            <td class="px-3 py-2 border">
                                <span class="font-medium text-xs">R \${(pricing.finalPrice || 0).toFixed(2)}</span>
                                \${hasCustomPrice ? '<span class="text-blue-500 text-xs">*</span>' : ''}
                            </td>
                            <td class="px-3 py-2 border text-center">
                                <span class="\${pricing.savingsPercent > 0 ? 'text-green-600' : 'text-gray-400'} text-xs">
                                    \${pricing.savingsPercent > 0 ? '-' + pricing.savingsPercent.toFixed(1) + '%' : '0%'}
                                </span>
                            </td>
                        </tr>
                    \`;
                }).join('');

                elements.productTableSection.classList.remove('hidden');
                elements.loadingState.classList.add('hidden');
                updatePricingSummary();
            }

            function toggleProductSelection(productId) {
                if (state.selectedProducts.has(productId)) {
                    state.selectedProducts.delete(productId);
                } else {
                    state.selectedProducts.add(productId);
                }
                renderEnhancedProductList();
            }

            function handleCustomPriceInput(productId, newPrice) {
                if (newPrice === '' || newPrice === null) {
                    delete state.customPrices[productId];
                } else {
                    state.customPrices[productId] = parseFloat(newPrice);
                }
                recalculateAllPricing();
            }

            function updatePricingSummary() {
                const selectedCount = state.selectedProducts.size;
                
                if (selectedCount > 0) {
                    elements.pricingSummary.classList.remove('hidden');
                    elements.generateFlexiblePdfBtn.disabled = false;
                    elements.generateQRPdfBtn.disabled = false;
                    elements.savePriceListBtn.disabled = false;
                    
                    const customPriced = Object.keys(state.customPrices).length;
                    
                    elements.summarySelectedCount.textContent = selectedCount;
                    elements.summaryCustomCount.textContent = customPriced;
                } else {
                    elements.pricingSummary.classList.add('hidden');
                    elements.generateFlexiblePdfBtn.disabled = true;
                    elements.generateQRPdfBtn.disabled = true;
                    elements.savePriceListBtn.disabled = true;
                }
            }

            async function generateFlexiblePDF() {
                try {
                    const selectedProductsArray = state.calculatedProducts.filter(p => 
                        state.selectedProducts.has(p.id)
                    );
                    
                    if (selectedProductsArray.length === 0) {
                        showError('Please select at least one product');
                        return;
                    }
                    
                    elements.generateFlexiblePdfBtn.disabled = true;
                    elements.generateFlexiblePdfBtn.textContent = 'Generating...';
                    
                    const companyInfo = {
                        name: document.getElementById('companyName').value || 'Your Company',
                        email: document.getElementById('companyEmail').value || '',
                        phone: document.getElementById('companyPhone').value || '',
                        website: document.getElementById('companyWebsite').value || '',
                        terms: 'Payment terms are COD. T\\'s & C\\'s Apply.'
                    };
                    
                    const pricingConfig = {
                        tierName: state.selectedTier,
                        discountPercent: state.tierDiscounts[state.selectedTier],
                        notes: ''
                    };
                    
                    const response = await fetch('/api/price-lists/generate-pdf-with-qr', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: \`\${state.selectedTier.charAt(0).toUpperCase() + state.selectedTier.slice(1)} Price List\`,
                            currency: 'ZAR',
                            products: selectedProductsArray,
                            company: companyInfo,
                            pricingConfig,
                            customPrices: state.customPrices,
                            clientInfo: {
                                name: 'Customer',
                                email: 'customer@example.com'
                            },
                            includeQR: true
                        })
                    });
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = \`\${state.selectedTier}-price-list-\${Date.now()}.pdf\`;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                        
                        showSuccess('🔥 PDF with QR code generated and downloaded! Customers can scan to order instantly!');
                    } else {
                        const error = await response.json();
                        showError('PDF generation failed: ' + error.message);
                    }
                } catch (error) {
                    showError('Error generating PDF: ' + error.message);
                } finally {
                    elements.generateFlexiblePdfBtn.disabled = false;
                    elements.generateFlexiblePdfBtn.textContent = 'Generate PDF';
                }
            }

            async function generateQRPDF() {
                try {
                    const selectedProductsArray = state.calculatedProducts.filter(p => 
                        state.selectedProducts.has(p.id)
                    );
                    
                    if (selectedProductsArray.length === 0) {
                        showError('Please select at least one product');
                        return;
                    }
                    
                    elements.generateQRPdfBtn.disabled = true;
                    elements.generateQRPdfBtn.textContent = 'Generating QR PDF...';
                    
                    const companyInfo = {
                        name: document.getElementById('companyName').value || 'Your Company',
                        email: document.getElementById('companyEmail').value || '',
                        phone: document.getElementById('companyPhone').value || '',
                        website: document.getElementById('companyWebsite').value || '',
                        terms: 'Payment terms are COD. T\\'s & C\\'s Apply.'
                    };
                    
                    const pricingConfig = {
                        tierName: state.selectedTier,
                        discountPercent: state.tierDiscounts[state.selectedTier],
                        notes: ''
                    };
                    
                    // Add client info for QR code generation
                    const clientInfo = {
                        name: 'Customer', // You can add input fields for this later
                        email: 'customer@example.com'
                    };
                    
                    const response = await fetch('/api/price-lists/generate-pdf-with-qr', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: \`\${state.selectedTier.charAt(0).toUpperCase() + state.selectedTier.slice(1)} Price List with QR Code\`,
                            currency: 'ZAR',
                            products: selectedProductsArray,
                            company: companyInfo,
                            pricingConfig,
                            customPrices: state.customPrices,
                            clientInfo,
                            includeQR: true
                        })
                    });
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = \`\${state.selectedTier}-price-list-qr-\${Date.now()}.pdf\`;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                        
                        showSuccess('🔥 QR PDF generated and downloaded! Customers can now scan to order instantly!');
                    } else {
                        const error = await response.json();
                        showError('QR PDF generation failed: ' + error.message);
                    }
                } catch (error) {
                    showError('Error generating QR PDF: ' + error.message);
                } finally {
                    elements.generateQRPdfBtn.disabled = false;
                    elements.generateQRPdfBtn.textContent = '🔥 Generate PDF with QR Code';
                }
            }

            async function savePriceList() {
                try {
                    const selectedProductsArray = state.calculatedProducts.filter(p => 
                        state.selectedProducts.has(p.id)
                    );
                    
                    if (selectedProductsArray.length === 0) {
                        showError('Please select at least one product');
                        return;
                    }
                    
                    const listName = prompt('Enter a name for this price list:');
                    if (!listName) return;
                    
                    elements.savePriceListBtn.disabled = true;
                    elements.savePriceListBtn.textContent = 'Saving...';
                    
                    const companyInfo = {
                        name: document.getElementById('companyName').value || 'Your Company',
                        email: document.getElementById('companyEmail').value || '',
                        phone: document.getElementById('companyPhone').value || '',
                        website: document.getElementById('companyWebsite').value || ''
                    };
                    
                    const pricingConfig = {
                        tierName: state.selectedTier,
                        discountPercent: state.tierDiscounts[state.selectedTier],
                        notes: ''
                    };
                    
                    const priceListData = {
                        name: listName,
                        products: selectedProductsArray,
                        company: companyInfo,
                        pricingConfig,
                        customPrices: state.customPrices,
                        createdAt: new Date().toISOString(),
                        totalProducts: selectedProductsArray.length,
                        totalValue: selectedProductsArray.reduce((sum, p) => sum + (p.pricing?.finalPrice || 0), 0)
                    };
                    
                    const response = await fetch('/api/price-lists/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(priceListData)
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        showSuccess(\`Price list "\${listName}" saved successfully!\`);
                    } else {
                        const error = await response.json();
                        showError('Failed to save price list: ' + error.message);
                    }
                } catch (error) {
                    showError('Error saving price list: ' + error.message);
                } finally {
                    elements.savePriceListBtn.disabled = false;
                    elements.savePriceListBtn.textContent = '💾 Save Price List';
                }
            }

            function showLoading(message) {
                elements.loadingState.innerHTML = \`
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p class="text-gray-600">\${message}</p>
                \`;
                elements.loadingState.classList.remove('hidden');
                elements.productTableSection.classList.add('hidden');
            }

            function hideLoading() {
                elements.loadingState.classList.add('hidden');
            }

            function showMessage(message, type) {
                const alertClass = {
                    success: 'bg-green-100 border-green-400 text-green-700',
                    error: 'bg-red-100 border-red-400 text-red-700',
                    info: 'bg-blue-100 border-blue-400 text-blue-700',
                    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700'
                }[type];

                const messageEl = document.createElement('div');
                messageEl.className = 'border-l-4 p-4 mb-4 ' + alertClass;
                messageEl.innerHTML = \`
                    <div class="flex justify-between">
                        <span>\${message}</span>
                        <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-sm">✕</button>
                    </div>
                \`;
                
                elements.statusMessages.appendChild(messageEl);
                
                setTimeout(() => {
                    if (messageEl.parentNode) {
                        messageEl.remove();
                    }
                }, 5000);
            }

            function showSuccess(message) { showMessage(message, 'success'); }
            function showError(message) { showMessage(message, 'error'); }
            function showInfo(message) { showMessage(message, 'info'); }
            function showWarning(message) { showMessage(message, 'warning'); }

            // Initialize
            selectTier('retail');
        </script>
    </body>
    </html>
  `;
  
  res.send(createHTML);
});

// My Price Lists page
app.get('/my-price-lists', (req, res) => {
  const myPriceListsHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My Price Lists - Price List Generator</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-4">
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-2xl font-bold text-gray-900">Price List Generator</a>
                        <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                            APP STATUS: ONLINE
                        </span>
                    </div>
                    <nav class="hidden md:flex space-x-6">
                        <a href="/" class="text-gray-700 hover:text-blue-600 font-medium">Home</a>
                        <a href="/my-price-lists" class="text-blue-600 font-medium border-b-2 border-blue-600">My Price Lists</a>
                        <a href="/create-price-list" class="text-gray-700 hover:text-blue-600 font-medium">Create New</a>
                    </nav>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900">My Price Lists</h1>
                <p class="mt-2 text-gray-600">Manage your saved price lists and generate new ones</p>
            </div>

            <!-- Status Messages -->
            <div id="statusMessages" class="mb-6"></div>

            <!-- Actions -->
            <div class="mb-6 flex gap-4">
                <a href="/create-price-list" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
                    ➕ Create New Price List
                </a>
                <button id="refreshBtn" class="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium">
                    🔄 Refresh
                </button>
            </div>

            <!-- Price Lists Grid -->
            <div class="bg-white rounded-lg shadow-md">
                <div class="p-6">
                    <div id="loadingState" class="text-center py-12">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p class="text-gray-600">Loading price lists...</p>
                    </div>
                    
                    <div id="priceListsGrid" class="hidden">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="priceListCards">
                            <!-- Price list cards will be inserted here -->
                        </div>
                    </div>
                    
                    <div id="emptyState" class="hidden text-center py-12">
                        <div class="text-6xl mb-4">📋</div>
                        <h3 class="text-xl font-semibold text-gray-900 mb-2">No price lists yet</h3>
                        <p class="text-gray-600 mb-6">Create your first price list to get started</p>
                        <a href="/create-price-list" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
                            Create Your First Price List
                        </a>
                    </div>
                </div>
            </div>
        </main>

        <script>
            let priceLists = [];

            const elements = {
                statusMessages: document.getElementById('statusMessages'),
                loadingState: document.getElementById('loadingState'),
                priceListsGrid: document.getElementById('priceListsGrid'),
                emptyState: document.getElementById('emptyState'),
                priceListCards: document.getElementById('priceListCards'),
                refreshBtn: document.getElementById('refreshBtn')
            };

            // Load price lists on page load
            document.addEventListener('DOMContentLoaded', async () => {
                await loadPriceLists();
            });

            elements.refreshBtn.addEventListener('click', async () => {
                await loadPriceLists();
            });

            async function loadPriceLists() {
                try {
                    showLoading();
                    elements.refreshBtn.disabled = true;
                    elements.refreshBtn.textContent = 'Loading...';

                    const response = await fetch('/api/price-lists');
                    const data = await response.json();

                    if (data.success) {
                        priceLists = data.priceLists || [];
                        renderPriceLists();
                        showSuccess(\`Loaded \${priceLists.length} price lists\`);
                    } else {
                        showError('Failed to load price lists: ' + data.message);
                    }
                } catch (error) {
                    showError('Error loading price lists: ' + error.message);
                } finally {
                    elements.refreshBtn.disabled = false;
                    elements.refreshBtn.textContent = '🔄 Refresh';
                }
            }

            function renderPriceLists() {
                hideLoading();

                if (priceLists.length === 0) {
                    elements.emptyState.classList.remove('hidden');
                    elements.priceListsGrid.classList.add('hidden');
                    return;
                }

                elements.emptyState.classList.add('hidden');
                elements.priceListsGrid.classList.remove('hidden');

                elements.priceListCards.innerHTML = priceLists.map(priceList => \`
                    <div class="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex-1">
                                <h3 class="text-lg font-semibold text-gray-900 mb-2">\${priceList.name}</h3>
                                <div class="flex items-center space-x-4 text-sm text-gray-600">
                                    <span class="flex items-center">
                                        <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                        \${priceList.pricingTier}
                                    </span>
                                    <span>\${priceList.totalProducts} products</span>
                                </div>
                            </div>
                            <div class="flex space-x-2">
                                <button onclick="viewPriceList('\${priceList.id}')" class="text-blue-600 hover:text-blue-800 p-1">
                                    👁️
                                </button>
                                <button onclick="duplicatePriceList('\${priceList.id}')" class="text-green-600 hover:text-green-800 p-1">
                                    📋
                                </button>
                                <button onclick="deletePriceList('\${priceList.id}')" class="text-red-600 hover:text-red-800 p-1">
                                    🗑️
                                </button>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <div class="text-2xl font-bold text-gray-900">R \${priceList.totalValue.toLocaleString()}</div>
                            <div class="text-sm text-gray-600">Total value</div>
                        </div>
                        
                        <div class="text-xs text-gray-500 mb-4">
                            Created: \${new Date(priceList.createdAt).toLocaleDateString()}
                        </div>
                        
                        <div class="flex space-x-2">
                            <button onclick="generatePDF('\${priceList.id}')" class="flex-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm">
                                🔥 Generate PDF
                            </button>
                            <button onclick="editPriceList('\${priceList.id}')" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
                                ✏️ Edit
                            </button>
                        </div>
                    </div>
                \`).join('');
            }

            async function viewPriceList(id) {
                try {
                    const response = await fetch(\`/api/price-lists/\${id}\`);
                    const data = await response.json();

                    if (data.success) {
                        const priceList = data.priceList;
                        alert(\`Price List: \${priceList.name}\\n\\nProducts: \${priceList.totalProducts}\\nValue: R \${priceList.totalValue.toLocaleString()}\\nTier: \${priceList.pricingConfig.tierName}\\nCreated: \${new Date(priceList.createdAt).toLocaleString()}\`);
                    } else {
                        showError('Failed to load price list details');
                    }
                } catch (error) {
                    showError('Error loading price list: ' + error.message);
                }
            }

            async function duplicatePriceList(id) {
                showInfo('Duplicate functionality coming soon...');
            }

            async function deletePriceList(id) {
                if (!confirm('Are you sure you want to delete this price list?')) return;

                try {
                    const response = await fetch(\`/api/price-lists/\${id}\`, {
                        method: 'DELETE'
                    });
                    const data = await response.json();

                    if (data.success) {
                        showSuccess('Price list deleted successfully');
                        await loadPriceLists();
                    } else {
                        showError('Failed to delete price list');
                    }
                } catch (error) {
                    showError('Error deleting price list: ' + error.message);
                }
            }

            async function generatePDF(id) {
                showInfo('PDF generation from saved lists coming soon...');
            }

            async function editPriceList(id) {
                showInfo('Edit functionality coming soon...');
            }

            function showLoading() {
                elements.loadingState.classList.remove('hidden');
                elements.priceListsGrid.classList.add('hidden');
                elements.emptyState.classList.add('hidden');
            }

            function hideLoading() {
                elements.loadingState.classList.add('hidden');
            }

            function showMessage(message, type) {
                const alertClass = {
                    success: 'bg-green-100 border-green-400 text-green-700',
                    error: 'bg-red-100 border-red-400 text-red-700',
                    info: 'bg-blue-100 border-blue-400 text-blue-700',
                    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700'
                }[type];

                const messageEl = document.createElement('div');
                messageEl.className = 'border-l-4 p-4 mb-4 ' + alertClass;
                messageEl.innerHTML = \`
                    <div class="flex justify-between">
                        <span>\${message}</span>
                        <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-sm">✕</button>
                    </div>
                \`;
                
                elements.statusMessages.appendChild(messageEl);
                
                setTimeout(() => {
                    if (messageEl.parentNode) {
                        messageEl.remove();
                    }
                }, 5000);
            }

            function showSuccess(message) { showMessage(message, 'success'); }
            function showError(message) { showMessage(message, 'error'); }
            function showInfo(message) { showMessage(message, 'info'); }
            function showWarning(message) { showMessage(message, 'warning'); }
        </script>
    </body>
    </html>
  `;
  
  res.send(myPriceListsHTML);
});

app.get('/import-document', (req, res) => {
  res.send('<h1>Import Document</h1><p>Coming soon...</p><a href="/">← Back to Home</a>');
});

app.get('/templates', (req, res) => {
  res.send('<h1>Templates</h1><p>Coming soon...</p><a href="/">← Back to Home</a>');
});

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 handler
app.use((req, res) => {
  res.status(404).send(`
    <html>
      <head><title>Page Not Found</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>Page Not Found</h1>
        <p>The requested page could not be found.</p>
        <a href="/" style="color: blue; text-decoration: underline;">Return to Home</a>
      </body>
    </html>
  `);
});

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log('🚀 Price List Generator server running on port ' + PORT);
  console.log('📱 Frontend: http://localhost:' + PORT);
  console.log('🔌 API: http://localhost:' + PORT + '/api/health');
  console.log('🛍️ Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('🔗 Shopify Configured: ' + (shopifyService.isConfigured() ? '✅ Yes' : '❌ No'));
});
