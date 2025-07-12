class PriceListManager {
  constructor() {
    this.selectedProducts = [];
    this.customerTier = 'retail';
    this.customPricing = {};
    this.companyInfo = {};
    this.init();
  }

  async init() {
    await this.loadProducts();
    this.setupEventListeners();
    this.renderInterface();
  }

  async loadProducts() {
    try {
      const response = await axios.get('/api/price-lists/products');
      this.products = response.data;
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  async generatePDF() {
    try {
      const response = await axios.post('/api/price-lists/generate-pdf', {
        priceListData: { products: this.selectedProducts },
        companyInfo: this.companyInfo,
        customerTier: this.customerTier
      }, {
        responseType: 'blob'
      });

      // Download the PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'price-list.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  }

  // Additional methods for UI interaction
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new PriceListManager();
});
