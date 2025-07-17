// QR Code Service - Handles QR code generation for checkout flows
import QRCode from 'qrcode';

export class QRService {
  constructor() {
    this.defaultOptions = {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    };
  }

  // Generate QR code for product checkout
  async generateProductQR(product, price, options = {}) {
    const baseUrl = options.baseUrl || process.env.APP_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/checkout?product=${product.id}&price=${price}`;
    
    const qrOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    try {
      return await QRCode.toDataURL(qrUrl, qrOptions);
    } catch (error) {
      console.error('Error generating product QR code:', error);
      throw new Error(`Failed to generate QR code for product ${product.id}`);
    }
  }

  // Generate QR code for entire price list checkout
  async generatePriceListQR(priceListId, options = {}) {
    const baseUrl = options.baseUrl || process.env.APP_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/checkout?priceList=${priceListId}`;
    
    const qrOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    try {
      return await QRCode.toDataURL(qrUrl, qrOptions);
    } catch (error) {
      console.error('Error generating price list QR code:', error);
      throw new Error(`Failed to generate QR code for price list ${priceListId}`);
    }
  }

  // Generate QR code for draft order
  async generateDraftOrderQR(draftOrderId, options = {}) {
    const baseUrl = options.baseUrl || process.env.APP_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/draft-order/${draftOrderId}`;
    
    const qrOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    try {
      return await QRCode.toDataURL(qrUrl, qrOptions);
    } catch (error) {
      console.error('Error generating draft order QR code:', error);
      throw new Error(`Failed to generate QR code for draft order ${draftOrderId}`);
    }
  }

  // Generate QR code for custom URL
  async generateCustomQR(url, options = {}) {
    const qrOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    try {
      return await QRCode.toDataURL(url, qrOptions);
    } catch (error) {
      console.error('Error generating custom QR code:', error);
      throw new Error(`Failed to generate QR code for URL: ${url}`);
    }
  }

  // Generate QR code as SVG
  async generateQRSVG(url, options = {}) {
    const qrOptions = {
      ...this.defaultOptions,
      ...options,
      type: 'svg'
    };
    
    try {
      return await QRCode.toString(url, qrOptions);
    } catch (error) {
      console.error('Error generating QR SVG:', error);
      throw new Error(`Failed to generate QR SVG for URL: ${url}`);
    }
  }

  // Generate QR code as PNG buffer (for server-side use)
  async generateQRBuffer(url, options = {}) {
    const qrOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    try {
      return await QRCode.toBuffer(url, qrOptions);
    } catch (error) {
      console.error('Error generating QR buffer:', error);
      throw new Error(`Failed to generate QR buffer for URL: ${url}`);
    }
  }

  // Generate multiple QR codes for a product list
  async generateBulkProductQRs(products, options = {}) {
    const results = [];
    
    for (const product of products) {
      try {
        const price = product.variants?.[0]?.price || 0;
        const qrCode = await this.generateProductQR(product, price, options);
        results.push({
          productId: product.id,
          productTitle: product.title,
          price,
          qrCode,
          success: true
        });
      } catch (error) {
        results.push({
          productId: product.id,
          productTitle: product.title,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  // Validate QR code options
  validateOptions(options) {
    const errors = [];
    
    if (options.width && (options.width < 50 || options.width > 1000)) {
      errors.push('Width must be between 50 and 1000 pixels');
    }
    
    if (options.margin && (options.margin < 0 || options.margin > 10)) {
      errors.push('Margin must be between 0 and 10');
    }
    
    if (options.errorCorrectionLevel && 
        !['L', 'M', 'Q', 'H'].includes(options.errorCorrectionLevel)) {
      errors.push('Error correction level must be L, M, Q, or H');
    }
    
    return errors;
  }

  // Get QR code info without generating
  getQRInfo(url, options = {}) {
    const qrOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    return {
      url,
      estimatedSize: this.estimateQRSize(url, qrOptions),
      options: qrOptions
    };
  }

  // Estimate QR code size
  estimateQRSize(url, options) {
    const dataLength = url.length;
    const errorLevel = options.errorCorrectionLevel || 'M';
    
    // Simple estimation based on data length
    let version = Math.ceil(dataLength / 25);
    version = Math.max(1, Math.min(version, 40));
    
    return {
      version,
      dataLength,
      errorLevel,
      estimatedPixels: 21 + (version - 1) * 4
    };
  }
}

// Create singleton instance
export const qrService = new QRService();
export default qrService;