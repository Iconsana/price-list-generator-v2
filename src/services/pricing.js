// Pricing Service - Handles all pricing calculations
export class PricingService {
  constructor() {
    this.defaultTiers = {
      retail: { discountPercent: 0, label: 'Retail' },
      wholesale: { discountPercent: 15, label: 'Wholesale' },
      installer: { discountPercent: 20, label: 'Installer' },
      distributor: { discountPercent: 25, label: 'Distributor' }
    };
  }

  // Flexible pricing calculator - user-defined discounts
  calculateFlexiblePricing(basePrice, tierConfig) {
    const discountMultiplier = (100 - (tierConfig.discountPercent || 0)) / 100;
    return parseFloat(basePrice) * discountMultiplier;
  }

  // Calculate pricing for a single product
  calculateProductPricing(product, tierConfig, customPrices = {}) {
    const basePrice = product.variants?.[0]?.price || 0;
    const productId = product.id;
    
    // Check for custom price override
    if (customPrices[productId]) {
      return {
        basePrice,
        finalPrice: customPrices[productId],
        hasCustomPrice: true,
        discountPercent: tierConfig.discountPercent || 0
      };
    }
    
    // Calculate tier pricing
    const finalPrice = this.calculateFlexiblePricing(basePrice, tierConfig);
    
    return {
      basePrice,
      finalPrice,
      hasCustomPrice: false,
      discountPercent: tierConfig.discountPercent || 0
    };
  }

  // Calculate pricing for multiple products
  calculateBulkPricing(products, tierConfig, customPrices = {}) {
    return products.map(product => ({
      ...product,
      pricing: this.calculateProductPricing(product, tierConfig, customPrices)
    }));
  }

  // Get tier configuration by name
  getTierConfig(tierName) {
    return this.defaultTiers[tierName] || this.defaultTiers.retail;
  }

  // Get all available tiers
  getAllTiers() {
    return this.defaultTiers;
  }

  // Format price for display
  formatPrice(price, currencyCode = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(price);
  }

  // Calculate total value for a price list
  calculateTotalValue(products, tierConfig, customPrices = {}) {
    return products.reduce((total, product) => {
      const pricing = this.calculateProductPricing(product, tierConfig, customPrices);
      return total + pricing.finalPrice;
    }, 0);
  }

  // Calculate savings compared to retail
  calculateSavings(products, tierConfig, customPrices = {}) {
    const retailTotal = this.calculateTotalValue(products, this.defaultTiers.retail, {});
    const tierTotal = this.calculateTotalValue(products, tierConfig, customPrices);
    
    return {
      retailTotal,
      tierTotal,
      savings: retailTotal - tierTotal,
      savingsPercent: ((retailTotal - tierTotal) / retailTotal) * 100
    };
  }
}

// Create singleton instance
export const pricingService = new PricingService();
export default pricingService;