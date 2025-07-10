// src/services/shopifyService.js - Real Shopify Integration
class ShopifyService {
constructor() {
this.shopDomain = process.env.SHOPIFY_SHOP_NAME || ‘cycle1-test.myshopify.com’;
this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
this.apiVersion = ‘2024-07’;
}

// Make GraphQL request to Shopify
async graphqlRequest(query, variables = {}) {
const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`;

```
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
```

}

// Get products with full details
async getProducts(limit = 50, cursor = null) {
const query = `query getProducts($first: Int!, $after: String) { products(first: $first, after: $after, query: "status:active") { edges { node { id title handle description productType vendor tags status createdAt updatedAt featuredImage { url altText width height } images(first: 5) { edges { node { url altText width height } } } variants(first: 10) { edges { node { id title price compareAtPrice sku barcode inventoryQuantity weight weightUnit requiresShipping taxable availableForSale } } } options { id name values } } cursor } pageInfo { hasNextPage hasPreviousPage startCursor endCursor } } }`;

```
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
    weight: variant.node.weight,
    weightUnit: variant.node.weightUnit,
    availableForSale: variant.node.availableForSale
  })),
  options: edge.node.options
}));

return {
  products,
  pageInfo: result.products.pageInfo,
  hasNextPage: result.products.pageInfo.hasNextPage,
  endCursor: result.products.pageInfo.endCursor
};
```

}

// Get shop information
async getShopInfo() {
const query = `query getShop { shop { id name email phone myshopifyDomain primaryDomain { url host } plan { displayName partnerDevelopment shopifyPlus } billingAddress { address1 address2 city province country zip } currencyCode currencyFormats { moneyFormat moneyWithCurrencyFormat } timezone ianaTimezone weightUnit } }`;

```
const result = await this.graphqlRequest(query);
return result.shop;
```

}

// Search products
async searchProducts(searchTerm, limit = 50) {
const query = `query searchProducts($query: String!, $first: Int!) { products(query: $query, first: $first) { edges { node { id title handle productType vendor tags featuredImage { url altText } variants(first: 1) { edges { node { id price sku inventoryQuantity } } } } } } }`;

```
const searchQuery = `title:*${searchTerm}* OR vendor:*${searchTerm}* OR product_type:*${searchTerm}* AND status:active`;

const result = await this.graphqlRequest(query, {
  query: searchQuery,
  first: limit
});

return result.products.edges.map(edge => edge.node);
```

}

// Get products by collection
async getProductsByCollection(collectionHandle, limit = 50) {
const query = `query getProductsByCollection($handle: String!, $first: Int!) { collectionByHandle(handle: $handle) { id title description products(first: $first) { edges { node { id title handle productType vendor featuredImage { url altText } variants(first: 1) { edges { node { id price sku inventoryQuantity } } } } } } } }`;

```
const result = await this.graphqlRequest(query, {
  handle: collectionHandle,
  first: limit
});

return result.collectionByHandle?.products.edges.map(edge => edge.node) || [];
```

}

// Get all collections
async getCollections(limit = 50) {
const query = `query getCollections($first: Int!) { collections(first: $first) { edges { node { id title description handle productsCount image { url altText } } } } }`;

```
const result = await this.graphqlRequest(query, {
  first: limit
});

return result.collections.edges.map(edge => edge.node);
```

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
message: ‘Failed to connect to Shopify’
};
}
}

// Check if properly configured
isConfigured() {
return !!(this.shopDomain && this.accessToken);
}
}

// Export singleton instance
export default new ShopifyService();