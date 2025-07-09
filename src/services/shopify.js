// src/services/shopify.js
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || 'read_products,write_products').split(','),
  hostName: process.env.HOST || 'localhost:3000',
  hostScheme: process.env.HOST_SCHEME || 'http',
  apiVersion: ApiVersion.July23,
  isEmbeddedApp: true,
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  }
});

class ShopifyService {
  constructor() {
    this.client = null;
    this.shop = process.env.SHOPIFY_SHOP_NAME;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  }

  // Initialize GraphQL client
  getClient() {
    if (!this.client && this.shop && this.accessToken) {
      this.client = new shopify.clients.Graphql({
        session: {
          shop: this.shop,
          accessToken: this.accessToken
        }
      });
    }
    return this.client;
  }

  // Execute GraphQL query
  async graphql(query, variables = {}) {
    try {
      const client = this.getClient();
      
      if (!client) {
        throw new Error('Shopify client not initialized. Missing shop or access token.');
      }

      console.log('🔍 Executing Shopify GraphQL query...');
      
      const response = await client.query({
        data: {
          query: query,
          variables: variables
        }
      });

      return response.body;
    } catch (error) {
      console.error('❌ Shopify GraphQL error:', error);
      throw error;
    }
  }

  // Fetch products with pagination
  async getProducts(limit = 250, cursor = null) {
    const query = `
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
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
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    barcode
                    inventoryQuantity
                    weight
                    weightUnit
                    requiresShipping
                    taxable
                    availableForSale
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

    return await this.graphql(query, {
      first: limit,
      after: cursor
    });
  }

  // Get shop information
  async getShop() {
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
          weightUnit
        }
      }
    `;

    return await this.graphql(query);
  }

  // Search products by title, vendor, or product type
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

    return await this.graphql(query, {
      query: searchTerm,
      first: limit
    });
  }

  // Get products by collection
  async getProductsByCollection(collectionId, limit = 50) {
    const query = `
      query getProductsByCollection($collectionId: ID!, $first: Int!) {
        collection(id: $collectionId) {
          id
          title
          description
          products(first: $first) {
            edges {
              node {
                id
                title
                handle
                productType
                vendor
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
      }
    `;

    return await this.graphql(query, {
      collectionId: `gid://shopify/Collection/${collectionId}`,
      first: limit
    });
  }

  // Get collections
  async getCollections(limit = 50) {
    const query = `
      query getCollections($first: Int!) {
        collections(first: $first) {
          edges {
            node {
              id
              title
              description
              handle
              productsCount
              image {
                url
                altText
              }
            }
          }
        }
      }
    `;

    return await this.graphql(query, {
      first: limit
    });
  }

  // Test connection
  async testConnection() {
    try {
      const response = await this.getShop();
      return {
        success: true,
        shop: response.data.shop,
        message: 'Connected successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Connection failed'
      };
    }
  }

  // Validate configuration
  isConfigured() {
    const requiredEnvVars = [
      'SHOPIFY_API_KEY',
      'SHOPIFY_API_SECRET',
      'SHOPIFY_SHOP_NAME',
      'SHOPIFY_ACCESS_TOKEN'
    ];

    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
      console.warn('⚠️ Missing Shopify configuration:', missing);
      return false;
    }

    return true;
  }
}

// Create singleton instance
const shopifyService = new ShopifyService();

// Check configuration on startup
if (!shopifyService.isConfigured()) {
  console.error('❌ Shopify service not properly configured');
  console.log('Required environment variables:');
  console.log('- SHOPIFY_API_KEY');
  console.log('- SHOPIFY_API_SECRET'); 
  console.log('- SHOPIFY_SHOP_NAME');
  console.log('- SHOPIFY_ACCESS_TOKEN');
} else {
  console.log('✅ Shopify service configured');
}

export default shopifyService;
