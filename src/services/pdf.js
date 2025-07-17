// PDF Service - Handles PDF generation and enhanced formatting
import QRCode from 'qrcode';

export class PDFService {
  constructor() {
    this.defaultCompanyConfig = {
      name: "Your Company Name",
      tagline: "Professional • Reliable • Quality",
      phone: "+1 234 567-8900",
      email: "sales@yourcompany.com",
      website: "https://yourcompany.com",
      address: "123 Business Street, City, Country",
      logo: null
    };
    
    this.defaultClientConfig = {
      name: "Client Company Name",
      category: "wholesale",
      showClientDetails: true,
      showPricingTier: true,
      hideVendorStock: true
    };
  }

  // Generate enhanced PDF with professional design
  async generateEnhancedPDF(products, options = {}) {
    const {
      companyConfig = {},
      clientConfig = {},
      pricingTier = 'wholesale',
      customPrices = {},
      includeQR = true,
      format = 'a4'
    } = options;

    const company = { ...this.defaultCompanyConfig, ...companyConfig };
    const client = { ...this.defaultClientConfig, ...clientConfig };

    // Import jsPDF for server-side use
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF('p', 'mm', format);

    // Page setup
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 0;

    // Add enhanced header
    currentY = await this.addEnhancedHeader(doc, company, client, currentY);
    
    // Add pricing tier information
    if (client.showPricingTier) {
      currentY = this.addPricingTierInfo(doc, pricingTier, currentY);
    }

    // Add products table
    currentY = await this.addEnhancedProductsTable(doc, products, {
      pricingTier,
      customPrices,
      hideVendorStock: client.hideVendorStock,
      includeQR,
      startY: currentY
    });

    // Add footer
    this.addEnhancedFooter(doc, company);

    return doc;
  }

  // Add enhanced header with company/client layout
  async addEnhancedHeader(doc, company, client, startY) {
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = startY + 15;

    // Add gradient background header
    doc.setFillColor(45, 55, 72); // Dark blue-gray
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Add lighter gradient effect
    doc.setFillColor(74, 85, 104);
    doc.rect(0, 35, pageWidth, 10, 'F');

    // Company section (left side)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(company.name, 15, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(company.tagline, 15, 32);
    
    doc.setFontSize(8);
    doc.text(company.phone, 15, 38);
    doc.text(company.email, 15, 42);

    // Client section (right side)
    if (client.showClientDetails) {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('QUOTE FOR:', pageWidth - 15, 20, { align: 'right' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(client.name, pageWidth - 15, 28, { align: 'right' });
      
      doc.setFontSize(8);
      if (client.email) {
        doc.text(client.email, pageWidth - 15, 35, { align: 'right' });
      }
      if (client.phone) {
        doc.text(client.phone, pageWidth - 15, 40, { align: 'right' });
      }
      doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 15, 45, { align: 'right' });
    }

    return 55;
  }

  // Add pricing tier information
  addPricingTierInfo(doc, pricingTier, startY) {
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = startY + 10;

    // Tier information box
    doc.setFillColor(248, 250, 252); // Light gray background
    doc.rect(15, currentY, pageWidth - 30, 20, 'F');
    
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, currentY, pageWidth - 30, 20, 'S');

    doc.setTextColor(45, 55, 72);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`PRICING TIER: ${pricingTier.toUpperCase()}`, 20, currentY + 8);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Prices shown reflect your approved pricing tier. Valid for 30 days.', 20, currentY + 15);

    return currentY + 30;
  }

  // Add enhanced products table
  async addEnhancedProductsTable(doc, products, options) {
    const {
      pricingTier,
      customPrices,
      hideVendorStock,
      includeQR,
      startY
    } = options;

    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = startY;

    // Table headers (no QR column for individual products)
    const headers = ['Product', 'SKU', 'Price'];

    // Table styling
    doc.setFillColor(45, 55, 72);
    doc.rect(15, currentY, pageWidth - 30, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    // Header positions
    const colPositions = [20, 90, 140];
    headers.forEach((header, index) => {
      doc.text(header, colPositions[index], currentY + 7);
    });

    currentY += 12;

    // Product rows
    for (const product of products) {
      const price = parseFloat(customPrices[product.id] || product.variants?.[0]?.price || 0);
      const sku = product.variants?.[0]?.sku || 'N/A';
      
      // Alternating row colors
      if ((products.indexOf(product) % 2) === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(15, currentY, pageWidth - 30, 12, 'F');
      }

      doc.setTextColor(45, 55, 72);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      // Product name (truncated if too long)
      let productName = product.title;
      if (productName.length > 35) {
        productName = productName.substring(0, 32) + '...';
      }
      doc.text(productName, colPositions[0], currentY + 7);
      
      // SKU
      doc.text(sku, colPositions[1], currentY + 7);
      
      // Price
      doc.setFont('helvetica', 'bold');
      doc.text(`R${price.toFixed(2)}`, colPositions[2], currentY + 7);

      currentY += 12;
      
      // Page break if needed
      if (currentY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = 20;
      }
    }

    // Add single QR code for entire price list if enabled
    if (includeQR) {
      currentY += 10;
      
      // QR Code section
      doc.setFillColor(248, 250, 252);
      doc.rect(15, currentY, pageWidth - 30, 40, 'F');
      
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, currentY, pageWidth - 30, 40, 'S');
      
      doc.setTextColor(45, 55, 72);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ORDER THIS QUOTE', 25, currentY + 12);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Scan QR code to order all items with exact pricing', 25, currentY + 20);
      
      try {
        // Generate QR code for entire price list
        const productIds = products.map(p => p.id).join(',');
        const qrUrl = `${process.env.APP_URL || 'http://localhost:3000'}/checkout?priceList=${productIds}`;
        const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 });
        doc.addImage(qrDataUrl, 'PNG', pageWidth - 50, currentY + 5, 30, 30);
      } catch (error) {
        console.error('Error generating QR code:', error);
        doc.setFontSize(10);
        doc.text('QR Code Error', pageWidth - 50, currentY + 20);
      }
      
      currentY += 45;
    }

    return currentY;
  }

  // Add enhanced footer
  addEnhancedFooter(doc, company) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Footer background
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageHeight - 25, pageWidth, 25, 'F');
    
    // Footer text
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`${company.name} • ${company.phone} • ${company.email}`, 15, pageHeight - 15);
    doc.text(`${company.website}`, 15, pageHeight - 10);
    
    // Page number
    doc.text(`Page 1`, pageWidth - 15, pageHeight - 10, { align: 'right' });
    
    // Terms
    doc.text('Prices valid for 30 days • Terms and conditions apply', pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  // Generate QR code for a product
  async generateProductQR(product, price, options = {}) {
    const baseUrl = options.baseUrl || process.env.APP_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/checkout?product=${product.id}&price=${price}`;
    
    try {
      return await QRCode.toDataURL(qrUrl, {
        width: options.width || 100,
        margin: options.margin || 1,
        color: {
          dark: options.darkColor || '#000000',
          light: options.lightColor || '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  }
}

// Create singleton instance
export const pdfService = new PDFService();
export default pdfService;