// src/routes/shopify.js
import express from 'express';
import shopify from '../services/shopify.js';

const router = express.Router();

// Get products from Shopify
router.get('/products', async (req, res) => {
  try {
    console.log('🛍️ Fetching products from Shopify...');
    
    // Get the shop session
    const session = req.session?.shop || process.env.SHOPIFY_SHOP_NAME;
    if (!session) {
      return res.status(400).json({ 
        success: false, 
        message: 'No shop session found' 
      });
    }

    // Fetch products using Shopify GraphQL API
    const graphql = `
      query getProducts($first: Int!) {
        products(first: $first) {
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
              featuredImage {
                url
                altText
              }
              variants(first: 5) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    inventoryQuantity
                    weight
                    weightUnit
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const response = await shopify.graphql(graphql, {
      variables: { first: 250 }
    });

    if (response.errors) {
      console.error('❌ Shopify GraphQL errors:', response.errors);
      return res.status(500).json({ 
        success: false, 
        message: 'Shopify API error',
        errors: response.errors 
      });
    }

    const products = response.data.products.edges.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description,
      productType: edge.node.productType,
      vendor: edge.node.vendor,
      tags: edge.node.tags,
      status: edge.node.status,
      featuredImage: edge.node.featuredImage,
      variants: edge.node.variants.edges.map(variantEdge => ({
        id: variantEdge.node.id,
        title: variantEdge.node.title,
        price: variantEdge.node.price,
        sku: variantEdge.node.sku,
        inventoryQuantity: variantEdge.node.inventoryQuantity,
        weight: variantEdge.node.weight,
        weightUnit: variantEdge.node.weightUnit
      }))
    }));

    console.log(`✅ Successfully fetched ${products.length} products`);

    res.json({
      success: true,
      products: products,
      count: products.length,
      hasNextPage: response.data.products.pageInfo.hasNextPage
    });

  } catch (error) {
    console.error('❌ Error fetching Shopify products:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch products from Shopify',
      error: error.message 
    });
  }
});

// Get shop information
router.get('/shop', async (req, res) => {
  try {
    const graphql = `
      query getShop {
        shop {
          name
          email
          phone
          myshopifyDomain
          primaryDomain {
            url
          }
          plan {
            displayName
          }
        }
      }
    `;

    const response = await shopify.graphql(graphql);

    if (response.errors) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch shop information',
        errors: response.errors 
      });
    }

    res.json({
      success: true,
      shop: response.data.shop
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

// Test Shopify connection
router.get('/test', async (req, res) => {
  try {
    const response = await shopify.graphql('{ shop { name } }');
    
    if (response.errors) {
      return res.status(500).json({ 
        success: false, 
        message: 'Shopify connection failed',
        errors: response.errors 
      });
    }

    res.json({
      success: true,
      message: 'Shopify connection successful',
      shopName: response.data.shop.name
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Shopify connection test failed',
      error: error.message 
    });
  }
});

export default router;
