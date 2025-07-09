// src/services/pdfGenerator.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure generated directory exists
const generatedDir = path.join(process.cwd(), 'generated');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

// Simple HTML to PDF converter (for now, can be enhanced with puppeteer later)
export async function generatePriceLisPDF(data) {
  try {
    const { title, currency, products, company, generatedAt } = data;
    
    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `price-list-${timestamp}-${Date.now()}.html`;
    const filePath = path.join(generatedDir, fileName);
    
    // Create HTML content for the price list
    const htmlContent = generatePriceListHTML({
      title,
      currency,
      products,
      company,
      generatedAt
    });
    
    // Write HTML file (this can be converted to PDF with puppeteer later)
    fs.writeFileSync(filePath, htmlContent);
    
    console.log(`✅ Price list HTML generated: ${fileName}`);
    
    return {
      success: true,
      filePath: filePath,
      fileName: fileName,
      downloadUrl: `/api/price-lists/download/${fileName}`,
      type: 'html' // Will be 'pdf' when we add puppeteer
    };
    
  } catch (error) {
    console.error('❌ PDF generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function generatePriceListHTML({ title, currency, products, company, generatedAt }) {
  const currencySymbol = getCurrencySymbol(currency);
  const totalProducts = products.length;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${company.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.4;
            color: #1a202c;
            background: #f7fafc;
        }
        
        .container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            min-height: 297mm;
        }
        
        /* Header Section */
        .header {
            background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
            color: white;
            padding: 40px;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 200px;
            height: 200px;
            background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            transform: translate(50px, -50px);
            opacity: 0.2;
        }
        
        .header-content {
            position: relative;
            z-index: 2;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        
        .company-info h1 {
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 8px;
            letter-spacing: -0.025em;
        }
        
        .company-info .terms {
            font-size: 0.9rem;
            opacity: 0.9;
            margin-top: 12px;
        }
        
        .title-badge {
            background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
            padding: 16px 24px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .title-badge h2 {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        .title-badge .subtitle {
            font-size: 0.85rem;
            opacity: 0.9;
        }
        
        /* Product Grid */
        .products-section {
            padding: 40px;
        }
        
        .section-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 24px;
            color: #2d3748;
            border-bottom: 3px solid #667eea;
            padding-bottom: 8px;
        }
        
        .products-grid {
            display: grid;
            gap: 24px;
        }
        
        .product-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 20px;
        }
        
        .product-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }
        
        .product-image {
            width: 80px;
            height: 80px;
            border-radius: 8px;
            object-fit: cover;
            border: 1px solid #e2e8f0;
            flex-shrink: 0;
        }
        
        .product-info {
            flex: 1;
            min-width: 0;
        }
        
        .product-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1a202c;
            margin-bottom: 8px;
            line-height: 1.3;
        }
        
        .product-details {
            font-size: 0.9rem;
            color: #4a5568;
            margin-bottom: 12px;
        }
        
        .product-details div {
            margin-bottom: 4px;
        }
        
        .product-price-section {
            text-align: right;
            flex-shrink: 0;
        }
        
        .warranty-badge {
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 500;
            margin-bottom: 8px;
            display: inline-block;
        }
        
        .product-price {
            background: #1a202c;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 1.3rem;
            font-weight: 700;
            margin-top: 8px;
        }
        
        .price-label {
            font-size: 0.7rem;
            opacity: 0.8;
            margin-top: 4px;
        }
        
        /* Footer */
        .footer {
            background: #1a202c;
            color: white;
            padding: 30px 40px;
            margin-top: 40px;
        }
        
        .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .footer-contact {
            font-size: 0.9rem;
        }
        
        .footer-contact div {
            margin-bottom: 4px;
        }
        
        .footer-qr {
            text-align: center;
        }
        
        .qr-placeholder {
            width: 80px;
            height: 80px;
            background: white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            color: #4a5568;
            margin-bottom: 8px;
        }
        
        .footer-label {
            font-size: 0.8rem;
            opacity: 0.8;
        }
        
        /* Print Styles */
        @media print {
            body { background: white; }
            .container { box-shadow: none; }
            .product-card { break-inside: avoid; }
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
                gap: 20px;
            }
            
            .footer-content {
                flex-direction: column;
                gap: 20px;
                text-align: center;
            }
            
            .product-card {
                flex-direction: column;
                text-align: center;
            }
            
            .product-price-section {
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <div class="header-content">
                <div class="company-info">
                    <h1>${company.name}</h1>
                    <div class="terms">${company.terms}</div>
                </div>
                <div class="title-badge">
                    <h2>${title.toUpperCase()}</h2>
                    <div class="subtitle">Professional Grade • Quality Assured</div>
                </div>
            </div>
        </header>

        <!-- Products Section -->
        <main class="products-section">
            <h2 class="section-title">Featured Products (${totalProducts} items)</h2>
            
            <div class="products-grid">
                ${products.map(product => `
                    <div class="product-card">
                        <img src="${product.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjdGQUZDIi8+CjxwYXRoIGQ9Ik00MCAyMEM0Ni42Mjc0IDIwIDUyIDI1LjM3MjYgNTIgMzJDNTIgMzguNjI3NCA0Ni42Mjc0IDQ0IDQwIDQ0QzMzLjM3MjYgNDQgMjggMzguNjI3NCAyOCAzMkMyOCAyNS4zNzI2IDMzLjM3MjYgMjAgNDAgMjBaTTQwIDQ2QzQ5IDQ2IDU2LjQgNTAuNCA1Ni40IDU2SDIzLjZDMjMuNiA1MC40IDMxIDQ2IDQwIDQ2WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K'}" 
                             alt="${product.title}" 
                             class="product-image"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjdGQUZDIi8+CjxwYXRoIGQ9Ik00MCAyMEM0Ni42Mjc0IDIwIDUyIDI1LjM3MjYgNTIgMzJDNTIgMzguNjI3NCA0Ni42Mjc0IDQ0IDQwIDQ0QzMzLjM3MjYgNDQgMjggMzguNjI3NCAyOCAzMkMyOCAyNS4zNzI2IDMzLjM3MjYgMjAgNDAgMjBaTTQwIDQ2QzQ5IDQ2IDU2LjQgNTAuNCA1Ni40IDU2SDIzLjZDMjMuNiA1MC40IDMxIDQ2IDQwIDQ2WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K'">
                        
                        <div class="product-info">
                            <h3 class="product-title">${product.title}</h3>
                            <div class="product-details">
                                ${product.sku ? `<div><strong>Model:</strong> ${product.sku}</div>` : ''}
                                <div><strong>Type:</strong> ${product.productType}</div>
                                ${product.vendor ? `<div><strong>Brand:</strong> ${product.vendor}</div>` : ''}
                            </div>
                        </div>
                        
                        <div class="product-price-section">
                            <div class="warranty-badge">3 YEARS</div>
                            <div class="product-price">
                                ${currencySymbol} ${parseFloat(product.price || '0').toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                <div class="price-label">INCL VAT</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </main>

        <!-- Footer -->
        <footer class="footer">
            <div class="footer-content">
                <div class="footer-contact">
                    <div>📞 ${company.phone}</div>
                    <div>✉️ ${company.email}</div>
                    <div>🌐 ${company.website}</div>
                </div>
                <div class="footer-qr">
                    <div class="qr-placeholder">QR</div>
                    <div class="footer-label">Scan to place orders online:</div>
                </div>
            </div>
        </footer>
    </div>
</body>
</html>`;
}

function getCurrencySymbol(currency) {
  const symbols = {
    'ZAR': 'R',
    'USD': '$',
    'EUR': '€',
    'GBP': '£'
  };
  return symbols[currency] || currency;
}

// Future enhancement: Add puppeteer for actual PDF generation
/*
import puppeteer from 'puppeteer';

export async function generatePriceLisPDF(data) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const htmlContent = generatePriceListHTML(data);
  await page.setContent(htmlContent);
  
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0',
      right: '0',
      bottom: '0',
      left: '0'
    }
  });
  
  await browser.close();
  
  const fileName = `price-list-${Date.now()}.pdf`;
  const filePath = path.join(generatedDir, fileName);
  fs.writeFileSync(filePath, pdfBuffer);
  
  return {
    success: true,
    filePath,
    fileName,
    downloadUrl: `/api/price-lists/download/${fileName}`
  };
}
*/
