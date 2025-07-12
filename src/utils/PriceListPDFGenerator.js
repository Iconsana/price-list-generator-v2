import jsPDF from 'jspdf';
import 'jspdf-autotable';

export class PriceListPDFGenerator {
  constructor(companyInfo, priceListData, settings = {}) {
    this.doc = new jsPDF();
    this.companyInfo = companyInfo;
    this.priceListData = priceListData;
    this.settings = {
      enableLinks: true,
      includeImages: true,
      customPricing: false,
      ...settings
    };
    this.currentY = 20;
  }

  // Generate the complete PDF
  generatePDF() {
    this.addHeader();
    this.addCompanyInfo();
    this.addProductTable();
    this.addFooter();
    return this.doc.output('arraybuffer'); // Return buffer for server response
  }

  // Add company header with branding
  addHeader() {
    const { doc } = this;
    
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text(this.companyInfo.name || 'Your Company', 20, 30);
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'normal');
    doc.text(this.priceListData.title || 'Professional Product Catalog', 20, 45);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 55);
    
    this.currentY = 70;
  }

  // Add company contact information
  addCompanyInfo() {
    const { doc, companyInfo } = this;
    
    doc.setFontSize(10);
    const leftColumn = 20;
    const rightColumn = 120;
    
    if (companyInfo.email) {
      doc.text(`Email: ${companyInfo.email}`, leftColumn, this.currentY);
    }
    
    if (companyInfo.phone) {
      doc.text(`Phone: ${companyInfo.phone}`, rightColumn, this.currentY);
    }
    
    this.currentY += 10;
    
    if (companyInfo.website) {
      doc.text(`Website: ${companyInfo.website}`, leftColumn, this.currentY);
    }
    
    this.currentY += 20;
  }

  // Generate the main product table with clickable links
  addProductTable() {
    const { doc, priceListData } = this;
    
    const tableColumns = [
      { header: 'Product', dataKey: 'name' },
      { header: 'Model/SKU', dataKey: 'model' },
      { header: 'Price', dataKey: 'price' },
      { header: 'Stock', dataKey: 'stock' }
    ];
    
    const tableRows = priceListData.products.map(product => ({
      name: product.name,
      model: product.model || product.sku,
      price: this.formatPrice(product.price, product.customPrice),
      stock: product.stock > 0 ? 'In Stock' : 'Out of Stock'
    }));

    doc.autoTable({
      columns: tableColumns,
      body: tableRows,
      startY: this.currentY,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 5
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      didDrawCell: (data) => {
        // Add clickable links for product names
        if (data.column.dataKey === 'name' && data.cell.section === 'body') {
          const product = priceListData.products[data.row.index];
          if (product.url && this.settings.enableLinks) {
            this.addProductLink(
              data.cell.x,
              data.cell.y,
              data.cell.width,
              data.cell.height,
              product.url
            );
          }
        }
      }
    });
    
    this.currentY = doc.lastAutoTable.finalY + 20;
  }

  // Add clickable link area for products
  addProductLink(x, y, width, height, url) {
    this.doc.link(x, y, width, height, { url: url });
    
    // Visual indicator for clickable area
    this.doc.setDrawColor(41, 128, 185);
    this.doc.setLineWidth(0.1);
    this.doc.line(x + 2, y + height - 2, x + width - 2, y + height - 2);
  }

  // Format price with custom pricing logic
  formatPrice(basePrice, customPrice = null) {
    const price = customPrice || basePrice;
    const currency = this.priceListData.currency || 'ZAR';
    
    if (currency === 'ZAR') {
      return `R ${parseFloat(price).toFixed(2)}`;
    }
    return `${currency} ${parseFloat(price).toFixed(2)}`;
  }

  // Add footer with terms
  addFooter() {
    const { doc } = this;
    const pageHeight = doc.internal.pageSize.height;
    
    if (this.companyInfo.terms) {
      doc.setFontSize(8);
      doc.text('Terms & Conditions:', 20, pageHeight - 30);
      doc.text(this.companyInfo.terms, 20, pageHeight - 25);
    }
  }
}

// Export function for easy use
export async function generateEnhancedPDF(companyInfo, products, customerTier = 'retail') {
  const processedProducts = products.map(product => ({
    ...product,
    customPrice: calculateCustomPrice(product.basePrice || product.price, customerTier),
    url: `${companyInfo.website}/products/${product.handle || product.id}`
  }));

  const priceListData = {
    title: `${customerTier.charAt(0).toUpperCase() + customerTier.slice(1)} Price List`,
    products: processedProducts,
    currency: 'ZAR'
  };

  const generator = new PriceListPDFGenerator(companyInfo, priceListData, {
    enableLinks: true,
    customPricing: true
  });

  return generator.generatePDF();
}

// Customer tier pricing logic
function calculateCustomPrice(basePrice, customerTier) {
  const pricingRules = {
    'retail': basePrice * 1.0,
    'wholesale': basePrice * 0.85,
    'distributor': basePrice * 0.75,
    'vip': basePrice * 0.70
  };
  
  return pricingRules[customerTier] || basePrice;
}
