// src/index.js - Complete Version with Fixed GraphQL Query
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import session from 'express-session';
import { shopifyApi } from '@shopify/shopify-api';
import dotenv from 'dotenv';

import priceListRoutes from './routes/priceList.js';

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

// Shopify API configuration
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_products'], // Updated scopes
  hostName: process.env.APP_URL?.replace('https://', '') || 'localhost',
  apiVersion: '2025-01',
  isEmbeddedApp: true,
});
  
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
app.use('/api/price-lists', priceListRoutes);

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

// Enhanced test endpoint
app.get('/api/shopify/test-enhanced', async (req, res) => {
  try {
    console.log('🧪 ENHANCED SHOPIFY TEST...');
    
    // Step 1: Check configuration
    if (!shopifyService.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Shopify not configured - missing environment variables',
        required: ['SHOPIFY_ACCESS_TOKEN', 'SHOPIFY_SHOP_NAME'],
        present: {
          SHOPIFY_ACCESS_TOKEN: !!process.env.SHOPIFY_ACCESS_TOKEN,
          SHOPIFY_SHOP_NAME: !!process.env.SHOPIFY_SHOP_NAME
        }
      });
    }
    
    // Step 2: Test different API endpoints to isolate the issue
    const tests = [];
    
    // Test 1: Basic shop info
    try {
      const shop = await shopifyService.getShopInfo();
      tests.push({
        test: 'getShopInfo',
        success: true,
        data: shop
      });
    } catch (error) {
      tests.push({
        test: 'getShopInfo',
        success: false,
        error: error.message
      });
    }
    
    // Test 2: Simple GraphQL query
    try {
      const result = await shopifyService.graphqlRequest('query { shop { name } }');
      tests.push({
        test: 'simpleQuery',
        success: true,
        data: result
      });
    } catch (error) {
      tests.push({
        test: 'simpleQuery',
        success: false,
        error: error.message
      });
    }
    
    // Test 3: Products query (limited)
    try {
      const result = await shopifyService.graphqlRequest(`
        query { 
          products(first: 1) { 
            edges { 
              node { 
                id 
                title 
              } 
            } 
          } 
        }
      `);
      tests.push({
        test: 'productsQuery',
        success: true,
        data: result
      });
    } catch (error) {
      tests.push({
        test: 'productsQuery',
        success: false,
        error: error.message
      });
    }
    
    const allSuccess = tests.every(test => test.success);
    
    res.json({
      success: allSuccess,
      message: allSuccess ? 'All tests passed!' : 'Some tests failed',
      tests: tests,
      config: {
        shopDomain: shopifyService.shopDomain,
        apiVersion: shopifyService.apiVersion,
        tokenPresent: !!shopifyService.accessToken,
        tokenPrefix: shopifyService.accessToken ? shopifyService.accessToken.substring(0, 8) + '...' : 'missing'
      }
    });

  } catch (error) {
    console.error('❌ Enhanced test error:', error);
    res.status(500).json({
      success: false,
      message: 'Enhanced test failed',
      error: error.message
    });
  }
});

// Simple PDF generation endpoint
app.post('/api/price-lists/generate-pdf', (req, res) => {
  try {
    const { title, currency, products, company } = req.body;
    
    // For now, just return success - we'll implement actual PDF generation later
    res.json({
      success: true,
      message: 'PDF generation successful!',
      downloadUrl: '/api/test-pdf',
      fileName: 'price-list-' + Date.now() + '.html',
      note: 'This is a mock response - full PDF generation will be implemented next'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'PDF generation failed',
      error: error.message
    });
  }
});

// Test PDF download
app.get('/api/test-pdf', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Test Price List</title></head>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1>🎉 PDF Generation Working!</h1>
        <p>This confirms your Price List Generator is working correctly.</p>
        <p><strong>Next steps:</strong> We'll enhance this with full Shopify integration and beautiful PDF templates.</p>
    </body>
    </html>
  `);
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

// Create price list page (Enhanced version with Shopify integration)

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
                        <a href="/import-document" class="text-gray-700 hover:text-blue-600 font-medium">Import Document</a>
                        <a href="/templates" class="text-gray-700 hover:text-blue-600 font-medium">Templates</a>
                    </nav>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900">Create New Price List</h1>
                <p class="mt-2 text-gray-600">Build professional price lists from your Shopify products</p>
            </div>

            <!-- Status Messages -->
            <div id="statusMessages" class="mb-6"></div>

            <!-- Main Form -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Left Panel - Configuration -->
                <div class="lg:col-span-1">
                    <div class="bg-white rounded-lg shadow-md p-6 space-y-6">
                        <!-- Company Information -->
                        <div>
                            <h3 class="text-lg font-semibold mb-4">Company Information</h3>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                                    <input type="text" id="companyName" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your Company Name">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input type="email" id="companyEmail" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="sales@company.com">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input type="tel" id="companyPhone" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+27 11 123 4567">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Website</label>
                                    <input type="url" id="companyWebsite" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://yourstore.com">
                                </div>
                            </div>
                        </div>

                        <!-- Price List Settings -->
                        <div>
                            <h3 class="text-lg font-semibold mb-4">Price List Settings</h3>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">List Title</label>
                                    <input type="text" id="listTitle" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Professional Product Catalog">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                                    <select id="currency" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="ZAR">ZAR (South African Rand)</option>
                                        <option value="USD">USD (US Dollar)</option>
                                        <option value="EUR">EUR (Euro)</option>
                                        <option value="GBP">GBP (British Pound)</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                                    <textarea id="terms" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Payment terms are COD. T's & C's Apply."></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Connection Status -->
                        <div id="connectionStatus" class="p-4 rounded-lg bg-gray-50">
                            <div class="text-sm text-gray-600">Shopify Connection: <span id="connectionText">Not tested</span></div>
                        </div>

                        <!-- Actions -->
                        <div class="space-y-3">
                            <button id="testConnectionBtn" class="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors">
                                Test Shopify Connection
                            </button>
                            <button id="loadProductsBtn" class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                                Load Shopify Products
                            </button>
                            <button id="generatePdfBtn" class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors" disabled>
                                Generate PDF Preview
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Right Panel - Product Selection -->
                <div class="lg:col-span-2">
                    <div class="bg-white rounded-lg shadow-md">
                        <!-- Search and Filters -->
                        <div class="p-6 border-b border-gray-200">
                            <div class="space-y-4">
                                <div class="flex flex-col sm:flex-row gap-4">
                                    <div class="flex-1">
                                        <input type="text" id="searchProducts" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search products, vendors, or types...">
                                    </div>
                                    <button id="searchBtn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                                        Search
                                    </button>
                                </div>
                                
                                <!-- Filter Options -->
                                <div class="flex flex-wrap gap-2">
                                    <select id="vendorFilter" class="px-3 py-1 border border-gray-300 rounded-md text-sm">
                                        <option value="">All Vendors</option>
                                    </select>
                                    <select id="typeFilter" class="px-3 py-1 border border-gray-300 rounded-md text-sm">
                                        <option value="">All Types</option>
                                    </select>
                                    <button id="clearFiltersBtn" class="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">
                                        Clear Filters
                                    </button>
                                </div>
                                
                                <!-- Action Buttons -->
                                <div class="flex justify-between items-center">
                                    <div class="flex gap-2">
                                        <button id="selectAllBtn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm">
                                            Select All Visible
                                        </button>
                                        <button id="clearSelectionBtn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm">
                                            Clear Selection
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Product List -->
                        <div class="p-6">
                            <div id="loadingState" class="text-center py-12">
                                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p class="text-gray-600">Click "Load Shopify Products" to begin</p>
                            </div>
                            
                            <div id="productList" class="hidden space-y-3 max-h-96 overflow-y-auto">
                                <!-- Products will be populated here -->
                            </div>
                            
                            <div id="selectedSummary" class="hidden mt-6 p-4 bg-blue-50 rounded-lg">
                                <p class="text-blue-800 font-medium">
                                    <span id="selectedCount">0</span> products selected for price list
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <script>
            // State management
            let state = {
                products: [],
                selectedProducts: [],
                filteredProducts: [],
                isLoading: false,
                allVendors: new Set(),
                allTypes: new Set()
            };

            // DOM elements
            const elements = {
                testConnectionBtn: document.getElementById('testConnectionBtn'),
                loadProductsBtn: document.getElementById('loadProductsBtn'),
                generatePdfBtn: document.getElementById('generatePdfBtn'),
                searchProducts: document.getElementById('searchProducts'),
                searchBtn: document.getElementById('searchBtn'),
                vendorFilter: document.getElementById('vendorFilter'),
                typeFilter: document.getElementById('typeFilter'),
                clearFiltersBtn: document.getElementById('clearFiltersBtn'),
                selectAllBtn: document.getElementById('selectAllBtn'),
                clearSelectionBtn: document.getElementById('clearSelectionBtn'),
                productList: document.getElementById('productList'),
                loadingState: document.getElementById('loadingState'),
                selectedSummary: document.getElementById('selectedSummary'),
                selectedCount: document.getElementById('selectedCount'),
                statusMessages: document.getElementById('statusMessages'),
                connectionStatus: document.getElementById('connectionStatus'),
                connectionText: document.getElementById('connectionText')
            };

            // Enhanced Test Shopify connection
            elements.testConnectionBtn.addEventListener('click', async () => {
                const btn = elements.testConnectionBtn;
                btn.disabled = true;
                btn.textContent = 'Testing...';
                
                try {
                    // First try the debug endpoint which we know works
                    let response = await fetch('/api/shopify/debug');
                    let data = await response.json();
                    
                    if (data.success) {
                        elements.connectionText.textContent = 'Connected to ' + data.shop.name + '';
                        elements.connectionStatus.className = 'p-4 rounded-lg bg-green-50';
                        showSuccess('Connected to ' + data.shop.name + ' successfully!');
                        
                        // Also test the products endpoint
                        try {
                            const productsResponse = await fetch('/api/shopify/products?limit=1');
                            const productsData = await productsResponse.json();
                            
                            if (productsData.success) {
                                showSuccess('Products API working - found ' + productsData.count + ' products available');
                            } else {
                                showWarning('Shop connected but products API needs attention: ' + productsData.message);
                            }
                        } catch (productsError) {
                            showWarning('Shop connected but products test failed: ' + productsError.message);
                        }
                        
                    } else {
                        // Fallback to original test endpoint
                        response = await fetch('/api/shopify/test');
                        data = await response.json();
                        
                        if (data.success) {
                            elements.connectionText.textContent = '✅ Connected';
                            elements.connectionStatus.className = 'p-4 rounded-lg bg-green-50';
                            showSuccess('Shopify connection successful!');
                        } else {
                            elements.connectionText.textContent = '❌ Failed';
                            elements.connectionStatus.className = 'p-4 rounded-lg bg-red-50';
                            showError('Connection failed: ' + data.message);
                        }
                    }
                } catch (error) {
                    elements.connectionText.textContent = '❌ Error';
                    elements.connectionStatus.className = 'p-4 rounded-lg bg-red-50';
                    showError('Connection test failed: ' + error.message);
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Test Shopify Connection';
                }
            });

            // Load products from Shopify
            elements.loadProductsBtn.addEventListener('click', async () => {
                await loadProducts();
            });

            // Search functionality
            elements.searchBtn.addEventListener('click', async () => {
                const searchTerm = elements.searchProducts.value.trim();
                if (searchTerm) {
                    await loadProducts(searchTerm);
                } else {
                    await loadProducts();
                }
            });

            // Search on Enter key
            elements.searchProducts.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    elements.searchBtn.click();
                }
            });

            // Filter functionality
            elements.vendorFilter.addEventListener('change', applyFilters);
            elements.typeFilter.addEventListener('change', applyFilters);
            elements.clearFiltersBtn.addEventListener('click', () => {
                elements.vendorFilter.value = '';
                elements.typeFilter.value = '';
                elements.searchProducts.value = '';
                applyFilters();
            });

            // Selection functionality
            elements.selectAllBtn.addEventListener('click', () => {
                const visibleProducts = state.filteredProducts;
                const allSelected = visibleProducts.every(product => 
                    state.selectedProducts.some(p => p.id === product.id)
                );

                if (allSelected) {
                    // Deselect all visible
                    state.selectedProducts = state.selectedProducts.filter(p => 
                        !visibleProducts.some(vp => vp.id === p.id)
                    );
                } else {
                    // Select all visible
                    visibleProducts.forEach(product => {
                        if (!state.selectedProducts.some(p => p.id === product.id)) {
                            state.selectedProducts.push(product);
                        }
                    });
                }
                
                renderProducts();
                updateSelectedSummary();
            });

            elements.clearSelectionBtn.addEventListener('click', () => {
                state.selectedProducts = [];
                renderProducts();
                updateSelectedSummary();
            });

            // Generate PDF
            elements.generatePdfBtn.addEventListener('click', async () => {
                if (state.selectedProducts.length === 0) {
                    showError('Please select at least one product');
                    return;
                }

                try {
                    elements.generatePdfBtn.disabled = true;
                    elements.generatePdfBtn.textContent = 'Generating PDF...';
                    
                    const companyInfo = {
                        name: document.getElementById('companyName').value || 'Your Company',
                        email: document.getElementById('companyEmail').value || 'sales@company.com',
                        phone: document.getElementById('companyPhone').value || '+27 11 123 4567',
                        website: document.getElementById('companyWebsite').value || 'https://yourstore.com',
                        terms: document.getElementById('terms').value || 'Payment terms are COD. T\\'s & C\\'s Apply.'
                    };

                    const priceListData = {
                        title: document.getElementById('listTitle').value || 'Product Catalog',
                        currency: document.getElementById('currency').value || 'ZAR',
                        products: state.selectedProducts,
                        company: companyInfo,
                        timestamp: new Date().toISOString()
                    };

                    const response = await fetch('/api/price-lists/generate-pdf', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(priceListData)
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        showSuccess('PDF generated successfully!');
                        if (result.downloadUrl) {
                            window.open(result.downloadUrl, '_blank');
                        }
                    } else {
                        showError('Failed to generate PDF: ' + (result.message || 'Unknown error'));
                    }
                } catch (error) {
                    showError('Error generating PDF: ' + error.message);
                } finally {
                    elements.generatePdfBtn.disabled = false;
                    elements.generatePdfBtn.textContent = 'Generate PDF Preview';
                }
            });

            // Load products function
            async function loadProducts(searchTerm = null) {
                try {
                    showLoading('Loading products from Shopify...');
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
                        
                        // Build filter options
                        buildFilterOptions();
                        
                        // Apply any existing filters
                        applyFilters();
                        
                        showSuccess('Loaded ' + state.products.length + ' products from Shopify');
                        
                        if (data.source === 'mock') {
                            showInfo('Using mock data. Configure Shopify credentials to load real products.');
                        }
                    } else {
                        showError('Failed to load products: ' + (data.message || 'Unknown error'));
                    }
                } catch (error) {
                    showError('Error loading products: ' + error.message);
                } finally {
                    hideLoading();
                    elements.loadProductsBtn.disabled = false;
                }
            }

            // Build filter options
            function buildFilterOptions() {
                // Reset filter sets
                state.allVendors.clear();
                state.allTypes.clear();
                
                // Collect unique vendors and types
                state.products.forEach(product => {
                    if (product.vendor) state.allVendors.add(product.vendor);
                    if (product.productType) state.allTypes.add(product.productType);
                });
                
                // Populate vendor filter
                elements.vendorFilter.innerHTML = '<option value="">All Vendors</option>';
                Array.from(state.allVendors).sort().forEach(vendor => {
                    const option = document.createElement('option');
                    option.value = vendor;
                    option.textContent = vendor;
                    elements.vendorFilter.appendChild(option);
                });
                
                // Populate type filter
                elements.typeFilter.innerHTML = '<option value="">All Types</option>';
                Array.from(state.allTypes).sort().forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    elements.typeFilter.appendChild(option);
                });
            }

            // Apply filters
            function applyFilters() {
                const vendorFilter = elements.vendorFilter.value;
                const typeFilter = elements.typeFilter.value;
                const searchTerm = elements.searchProducts.value.toLowerCase();
                
                state.filteredProducts = state.products.filter(product => {
                    const matchesVendor = !vendorFilter || product.vendor === vendorFilter;
                    const matchesType = !typeFilter || product.productType === typeFilter;
                    const matchesSearch = !searchTerm || 
                        product.title.toLowerCase().includes(searchTerm) ||
                        (product.vendor && product.vendor.toLowerCase().includes(searchTerm)) ||
                        (product.productType && product.productType.toLowerCase().includes(searchTerm));
                    
                    return matchesVendor && matchesType && matchesSearch;
                });
                
                renderProducts();
            }

            // Render products
            function renderProducts() {
                if (state.filteredProducts.length === 0) {
                    elements.productList.innerHTML = '<p class="text-gray-500 text-center py-8">No products found</p>';
                    elements.productList.classList.remove('hidden');
                    elements.loadingState.classList.add('hidden');
                    return;
                }

                const html = state.filteredProducts.map(product => {
                    const isSelected = state.selectedProducts.some(p => p.id === product.id);
                    const variant = product.variants && product.variants[0] ? product.variants[0] : {};
                    const price = variant.price || 0;
                    const image = product.featuredImage && product.featuredImage.url ? product.featuredImage.url : 'https://via.placeholder.com/64x64?text=No+Image';
                    
                    return [
                        '<div class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors ' + (isSelected ? 'bg-blue-50 border-blue-300' : '') + '">',
                        '<div class="flex items-start space-x-4">',
                        '<div class="flex-shrink-0">',
                        '<input type="checkbox" class="product-checkbox mt-1" data-product-id="' + product.id + '"' + (isSelected ? ' checked' : '') + '>',
                        '</div>',
                        '<div class="flex-shrink-0">',
                        '<img src="' + image + '" alt="' + product.title + '" class="w-16 h-16 object-cover rounded-md border" onerror="this.src=\\'https://via.placeholder.com/64x64?text=No+Image\\'">',
                        '</div>',
                        '<div class="flex-1 min-w-0">',
                        '<h4 class="text-sm font-medium text-gray-900 truncate">' + product.title + '</h4>',
                        '<p class="text-sm text-gray-500">' + (product.vendor || 'Unknown Vendor') + '</p>',
                        '<p class="text-sm text-gray-500">' + (product.productType || 'Uncategorized') + '</p>',
                        '<div class="mt-2">',
                        '<span class="text-lg font-semibold text-gray-900">R ' + price.toFixed(2) + '</span>',
                        (variant.sku ? '<span class="ml-2 text-xs text-gray-500">SKU: ' + variant.sku + '</span>' : ''),
                        '</div>',
                        '<div class="text-xs text-gray-400 mt-1">',
                        'Stock: ' + (variant.inventoryQuantity || 0),
                        '</div>',
                        '</div>',
                        '</div>',
                        '</div>'
                    ].join('');
                }).join('');

                elements.productList.innerHTML = html;
                elements.productList.classList.remove('hidden');
                elements.loadingState.classList.add('hidden');

                // Add event listeners to checkboxes
                document.querySelectorAll('.product-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', handleProductSelection);
                });

                updateSelectedSummary();
            }

            // Handle product selection
            function handleProductSelection(e) {
                const productId = e.target.dataset.productId;
                const product = state.products.find(p => p.id === productId);
                
                if (e.target.checked) {
                    if (!state.selectedProducts.some(p => p.id === productId)) {
                        state.selectedProducts.push(product);
                    }
                } else {
                    state.selectedProducts = state.selectedProducts.filter(p => p.id !== productId);
                }
                
                updateSelectedSummary();
            }

            // Update selected summary
            function updateSelectedSummary() {
                elements.selectedCount.textContent = state.selectedProducts.length;
                
                if (state.selectedProducts.length > 0) {
                    elements.selectedSummary.classList.remove('hidden');
                    elements.generatePdfBtn.disabled = false;
                } else {
                    elements.selectedSummary.classList.add('hidden');
                    elements.generatePdfBtn.disabled = true;
                }
            }

            // Utility functions
            function showLoading(message) {
                elements.loadingState.innerHTML = [
                    '<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>',
                    '<p class="text-gray-600">' + message + '</p>'
                ].join('');
                elements.loadingState.classList.remove('hidden');
                elements.productList.classList.add('hidden');
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
                }[type] || 'bg-blue-100 border-blue-400 text-blue-700';

                const messageEl = document.createElement('div');
                messageEl.className = 'border-l-4 p-4 mb-4 ' + alertClass;
                messageEl.innerHTML = [
                    '<div class="flex justify-between">',
                    '<span>' + message + '</span>',
                    '<button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-sm underline">✕</button>',
                    '</div>'
                ].join('');
                
                elements.statusMessages.appendChild(messageEl);
                
                // Auto-remove after 5 seconds
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
  
  res.send(createHTML);
});

app.get('/create-price-list', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/create-price-list.html'));
});



// Other pages with simple placeholders
app.get('/my-price-lists', (req, res) => {
  res.send('<h1>My Price Lists</h1><p>Coming soon...</p><a href="/">← Back to Home</a>');
});

app.get('/import-document', (req, res) => {
  res.send('<h1>Import Document</h1><p>Coming soon...</p><a href="/">← Back to Home</a>');
});

app.get('/templates', (req, res) => {
  res.send('<h1>Templates</h1><p>Coming soon...</p><a href="/">← Back to Home</a>');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
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
