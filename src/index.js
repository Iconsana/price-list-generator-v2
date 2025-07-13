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

// Shopify API configuration
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_products'], // Updated scopes
  hostName: process.env.APP_URL?.replace('https://', '') || 'localhost',
  apiVersion: '2025-01',
  isEmbeddedApp: true,
});

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

// Enhanced PDF generation with flexible user-defined pricing
app.post('/api/price-lists/generate-pdf-flexible', async (req, res) => {
  try {
    const { 
      title, 
      currency, 
      products, 
      company, 
      pricingConfig = {},
      customPrices = {} // Individual product price overrides
    } = req.body;
    
    console.log('📄 Generating flexible PDF with user-defined pricing');
    
    // Import jsPDF
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text(company?.name || 'Your Company', 20, 30);
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'normal');
    doc.text(title || 'Custom Price List', 20, 45);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 55);
    
    // Show pricing configuration used
    if (pricingConfig.tierName) {
      doc.text(`Pricing Tier: ${pricingConfig.tierName}`, 120, 55);
    }
    if (pricingConfig.discountPercent) {
      doc.text(`Base Discount: ${pricingConfig.discountPercent}%`, 120, 65);
    }
    
    // Company info
    let yPos = 75;
    if (company?.email) doc.text(`📧 ${company.email}`, 20, yPos), yPos += 8;
    if (company?.phone) doc.text(`📞 ${company.phone}`, 120, yPos - 8);
    if (company?.website) doc.text(`🌐 ${company.website}`, 20, yPos), yPos += 15;
    
    // Table with flexible pricing
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
      
      // Check if there's a custom price override for this specific product
      const hasCustomPrice = customPrices[product.id] !== undefined;
      let finalPrice;
      
      if (hasCustomPrice) {
        // Use the manually set price
        finalPrice = parseFloat(customPrices[product.id]);
      } else {
        // Use the tier discount percentage
        finalPrice = calculateFlexiblePricing(basePrice, pricingConfig);
      }
      
      const savings = basePrice - finalPrice;
      const savingsPercent = basePrice > 0 ? ((savings / basePrice) * 100).toFixed(1) : '0';
      
      return {
        name: product.title?.substring(0, 30) + (product.title?.length > 30 ? '...' : '') || 'Unknown',
        vendor: product.vendor || 'Unknown',
        basePrice: `R ${basePrice.toFixed(2)}`,
        finalPrice: `R ${finalPrice.toFixed(2)}` + (hasCustomPrice ? ' *' : ''),
        savings: savings > 0 ? `-${savingsPercent}%` : '0%',
        stock: variant.inventoryQuantity > 0 ? '✅' : '❌'
      };
    });
    
    doc.autoTable({
      columns: tableColumns,
      body: tableRows,
      startY: yPos,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [52, 152, 219], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 45 }, // Product name
        1: { cellWidth: 25 }, // Vendor
        2: { cellWidth: 25, halign: 'right' }, // Base price
        3: { cellWidth: 25, halign: 'right', fillColor: [240, 248, 255] }, // Final price
        4: { cellWidth: 20, halign: 'center' }, // Savings
        5: { cellWidth: 15, halign: 'center' } // Stock
      }
    });
    
    // Footer with notes
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    
    // Add legend
    let footerY = pageHeight - 35;
    doc.text('* Custom pricing applied for specific products', 20, footerY);
    footerY += 8;
    
    if (pricingConfig.notes) {
      doc.text(`Notes: ${pricingConfig.notes}`, 20, footerY);
      footerY += 8;
    }
    
    if (company?.terms) {
      doc.text(`Terms: ${company.terms}`, 20, footerY);
    }
    
    const pdfBuffer = doc.output('arraybuffer');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="custom-price-list-${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.byteLength);
    res.end(Buffer.from(pdfBuffer));
    
    console.log('✅ Flexible PDF generated successfully');
    
  } catch (error) {
    console.error('❌ Flexible PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Flexible PDF generation failed',
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
                                Generate PDF
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
                    
                    const customPriced = Object.keys(state.customPrices).length;
                    
                    elements.summarySelectedCount.textContent = selectedCount;
                    elements.summaryCustomCount.textContent = customPriced;
                } else {
                    elements.pricingSummary.classList.add('hidden');
                    elements.generateFlexiblePdfBtn.disabled = true;
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
                    
                    const response = await fetch('/api/price-lists/generate-pdf-flexible', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: \`\${state.selectedTier.charAt(0).toUpperCase() + state.selectedTier.slice(1)} Price List\`,
                            currency: 'ZAR',
                            products: selectedProductsArray,
                            company: companyInfo,
                            pricingConfig,
                            customPrices: state.customPrices
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
                        
                        showSuccess('PDF generated and downloaded!');
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

// Other pages
app.get('/my-price-lists', (req, res) => {
  res.send('<h1>My Price Lists</h1><p>Coming soon...</p><a href="/">← Back to Home</a>');
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
