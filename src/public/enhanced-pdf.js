// Enhanced PDF Generation - Add to src/public/enhanced-pdf.js
// This extends your existing PDF functionality without breaking it

class EnhancedPDFGenerator {
    constructor() {
        this.defaultCompanyConfig = {
            name: "Your Company Name",
            tagline: "Professional • Reliable • Quality",
            phone: "+1 234 567-8900",
            email: "sales@yourcompany.com",
            website: "https://yourcompany.com",
            address: "123 Business Street, City, Country"
        };
        
        this.defaultClientConfig = {
            name: "Client Company Name",
            category: "wholesale",
            showClientDetails: true,
            showPricingTier: true
        };
    }

    // Enhanced PDF generation with your current structure intact
    generateEnhancedPDF(products, customCompanyConfig = {}, customClientConfig = {}) {
        const companyConfig = { ...this.defaultCompanyConfig, ...customCompanyConfig };
        const clientConfig = { ...this.defaultClientConfig, ...customClientConfig };
        
        // Use your existing jsPDF setup
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Page setup
        const pageWidth = 210;
        const pageHeight = 297;
        let currentY = 0;
        
        // Add enhanced header
        this.addEnhancedHeader(doc, companyConfig, clientConfig);
        currentY = 45;
        
        // Add subheader
        this.addSubheader(doc, companyConfig, currentY);
        currentY += 15;
        
        // Add table
        this.addEnhancedTable(doc, products, currentY);
        
        // Add footer
        this.addEnhancedFooter(doc, companyConfig);
        
        return doc;
    }

    addEnhancedHeader(doc, companyConfig, clientConfig) {
        // Background gradient effect
        doc.setFillColor(44, 62, 80); // Dark blue
        doc.rect(0, 0, 210, 35, 'F');
        
        doc.setFillColor(52, 152, 219); // Light blue accent
        doc.rect(0, 30, 210, 5, 'F');
        
        // Company section (left)
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(15, 8, 20, 20, 3, 3, 'F');
        doc.setTextColor(44, 62, 80);
        doc.setFontSize(8);
        doc.text('LOGO', 25, 20, { align: 'center' });
        
        // Company name and tagline
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(companyConfig.name, 40, 18);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(companyConfig.tagline, 40, 24);
        
        // Client section (right) - only if enabled
        if (clientConfig.showClientDetails) {
            doc.setFillColor(255, 255, 255, 0.1);
            doc.roundedRect(140, 8, 55, 22, 2, 2, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('PREPARED FOR:', 145, 14);
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(clientConfig.name, 145, 20);
            
            // Pricing tier badge
            if (clientConfig.showPricingTier) {
                const category = this.getPricingCategory(clientConfig.category);
                doc.setFillColor(category.color.r, category.color.g, category.color.b);
                doc.roundedRect(145, 22, 35, 6, 2, 2, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text(`${category.label.toUpperCase()} PRICING`, 162.5, 26, { align: 'center' });
            }
        }
    }

    addSubheader(doc, companyConfig, currentY) {
        doc.setFillColor(52, 73, 94);
        doc.rect(0, currentY, 210, 10, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Professional Price List', 15, currentY + 7);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const today = new Date().toLocaleDateString();
        doc.text(`Generated: ${today}`, 195, currentY + 7, { align: 'right' });
    }

    addEnhancedTable(doc, products, startY) {
        let currentY = startY;
        
        // Table headers (REMOVED vendor and stock columns)
        const headers = ['Product Details', 'Specifications', 'Price'];
        const columnWidths = [80, 70, 40];
        
        // Header background
        doc.setFillColor(44, 62, 80);
        doc.rect(10, currentY, 190, 10, 'F');
        
        // Header text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        
        let x = 15;
        headers.forEach((header, index) => {
            doc.text(header, x, currentY + 7);
            x += columnWidths[index];
        });
        
        currentY += 12;
        
        // Product rows
        products.forEach((product, index) => {
            this.addProductRow(doc, product, currentY, index);
            currentY += 20;
        });
    }

    addProductRow(doc, product, currentY, index) {
        // Alternating row background
        if (index % 2 === 0) {
            doc.setFillColor(248, 249, 250);
            doc.rect(10, currentY, 190, 20, 'F');
        }
        
        // Product name (with link capability)
        doc.setTextColor(44, 62, 80);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        
        // Make product name clickable if URL exists
        if (product.url) {
            doc.setTextColor(52, 152, 219); // Blue for links
            doc.textWithLink(product.name, 15, currentY + 7, { url: product.url });
        } else {
            doc.text(product.name, 15, currentY + 7);
        }
        
        // Product model/SKU
        doc.setTextColor(127, 140, 141);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Model: ${product.model || 'N/A'}`, 15, currentY + 13);
        
        // Specifications (middle column)
        const specs = [
            product.capacity || '',
            product.voltage || '',
            product.dimensions || ''
        ].filter(Boolean).join(' • ');
        
        doc.setTextColor(127, 140, 141);
        doc.setFontSize(8);
        doc.text(specs, 95, currentY + 10, { maxWidth: 65 });
        
        // Price (right column)
        doc.setTextColor(231, 76, 60);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`R ${product.finalPrice}`, 185, currentY + 10, { align: 'right' });
        
        doc.setTextColor(127, 140, 141);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('INCL VAT', 185, currentY + 16, { align: 'right' });
    }

    addEnhancedFooter(doc, companyConfig) {
        const footerY = 267; // Fixed footer position
        
        // Footer background
        doc.setFillColor(44, 62, 80);
        doc.rect(0, footerY, 210, 30, 'F');
        
        // Contact information
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        
        const contacts = [
            `📞 ${companyConfig.phone}`,
            `✉️ ${companyConfig.email}`,
            `🌐 ${companyConfig.website}`
        ];
        
        contacts.forEach((contact, index) => {
            doc.text(contact, 15, footerY + 8 + (index * 4));
        });
        
        // QR Code placeholder
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(170, footerY + 5, 20, 20, 2, 2, 'F');
        doc.setTextColor(44, 62, 80);
        doc.setFontSize(6);
        doc.text('QR CODE', 180, footerY + 15, { align: 'center' });
        
        // Terms
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text('• Prices subject to change • Payment terms: COD • T&Cs Apply', 
                 105, footerY + 27, { align: 'center' });
    }

    getPricingCategory(category) {
        const categories = {
            wholesale: { label: 'Wholesale', color: { r: 52, g: 152, b: 219 } },
            installer: { label: 'Installer', color: { r: 230, g: 126, b: 34 } },
            distributor: { label: 'Distributor', color: { r: 231, g: 76, b: 60 } },
            retail: { label: 'Retail', color: { r: 149, g: 165, b: 166 } }
        };
        return categories[category] || categories.wholesale;
    }
}

// Export for use in your main app
window.EnhancedPDFGenerator = EnhancedPDFGenerator;
