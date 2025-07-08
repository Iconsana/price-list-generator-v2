// Price List Generator - Main Server
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import multer from 'multer';

// Import services
import { getDB, initDB } from './services/database.js';
import { fetchAllProducts } from './services/product-service.js';
import { processQuoteWithClaude } from './services/claude-service.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ES Module path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '../public');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'document-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'image/png' || 
        file.mimetype === 'image/jpeg' || 
        file.mimetype === 'image/jpg') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  }
});

// Utility function to send HTML files with navigation
function sendFileWithNav(res, filePath) {
  try {
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      console.log(`File not found: ${filePath}`);
      res.status(404).send(`
        <html>
          <head><title>Page Not Found</title></head>
          <body>
            <h1>Page Not Found</h1>
            <p>The requested page could not be found.</p>
            <a href="/">Return to Home</a>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).send('Internal Server Error');
  }
}

// Serve static files from public directory
app.use(express.static(publicPath));

// Create public directory if it doesn't exist
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
}

// Root route - serve index.html or API status
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    sendFileWithNav(res, path.join(publicPath, 'index.html'));
  } else {
    res.status(200).json({ 
      status: 'healthy',
      message: 'Price List Generator App Running',
      timestamp: new Date().toISOString()
    });
  }
});

// Test connection endpoint
app.get('/test-connection', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    status: 'success',
    message: 'API connection successful',
    time: new Date().toISOString()
  });
});

// ===========================================
// PRICE LIST GENERATOR ROUTES
// ===========================================

// Create new price list page
app.get('/create-price-list', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'create-price-list.html'));
});

// My price lists page
app.get('/my-price-lists', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'my-price-lists.html'));
});

// Templates management page
app.get('/templates', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'templates.html'));
});

// Product selection page
app.get('/products', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'product-selection.html'));
});

// Edit price list page
app.get('/edit-price-list/:id', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'edit-price-list.html'));
});

// Import document page
app.get('/import-document', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'import-document.html'));
});

// ===========================================
// API ROUTES FOR PRICE LIST GENERATOR
// ===========================================

// Get products from Shopify
app.get('/api/products', async (req, res) => {
  try {
    console.log('Fetching products from Shopify...');
    
    // Try to get cached products first
    const db = await getDB();
    await db.read();
    
    // If we have cached products and they're recent (less than 1 hour old)
    if (db.data.products && db.data.products.length > 0 && db.data.lastProductSync) {
      const lastSync = new Date(db.data.lastProductSync);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (lastSync > hourAgo) {
        console.log(`Returning ${db.data.products.length} cached products`);
        return res.json(db.data.products);
      }
    }
    
    // Fetch fresh products from Shopify
    const products = await fetchAllProducts();
    
    // Cache the products
    db.data.products = products;
    db.data.lastProductSync = new Date().toISOString();
    await db.write();
    
    console.log(`Fetched and cached ${products.length} products from Shopify`);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      message: error.message 
    });
  }
});

// Get saved price lists
app.get('/api/price-lists', async (req, res) => {
  try {
    const db = await getDB();
    await db.read();
    
    const priceLists = db.data.priceLists || [];
    
    // Add product count and last modified info
    const enrichedPriceLists = priceLists.map(list => ({
      ...list,
      productCount: list.products ? list.products.length : 0,
      lastModified: list.updatedAt || list.createdAt
    }));
    
    res.json(enrichedPriceLists);
  } catch (error) {
    console.error('Error fetching price lists:', error);
    res.status(500).json({ 
      error: 'Failed to fetch price lists',
      message: error.message 
    });
  }
});

// Get specific price list
app.get('/api/price-lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    await db.read();
    
    const priceList = db.data.priceLists?.find(list => list.id === id);
    
    if (!priceList) {
      return res.status(404).json({ error: 'Price list not found' });
    }
    
    res.json(priceList);
  } catch (error) {
    console.error('Error fetching price list:', error);
    res.status(500).json({ 
      error: 'Failed to fetch price list',
      message: error.message 
    });
  }
});

// Create new price list
app.post('/api/price-lists', async (req, res) => {
  try {
    const { name, products, template, settings, companyInfo } = req.body;
    
    if (!name || !products || !Array.isArray(products)) {
      return res.status(400).json({ 
        error: 'Missing required fields: name and products array' 
      });
    }
    
    const db = await getDB();
    await db.read();
    
    const newPriceList = {
      id: Date.now().toString(),
      name: name.trim(),
      products: products,
      template: template || 'default',
      settings: {
        currency: 'USD',
        showImages: true,
        showDescriptions: true,
        groupByCategory: false,
        ...settings
      },
      companyInfo: {
        name: 'Your Company',
        email: 'contact@company.com',
        phone: '+1 (555) 123-4567',
        website: 'https://yourcompany.com',
        ...companyInfo
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (!db.data.priceLists) db.data.priceLists = [];
    db.data.priceLists.push(newPriceList);
    await db.write();
    
    console.log(`Created new price list: ${newPriceList.name} with ${products.length} products`);
    res.status(201).json(newPriceList);
  } catch (error) {
    console.error('Error creating price list:', error);
    res.status(500).json({ 
      error: 'Failed to create price list',
      message: error.message 
    });
  }
});

// Update existing price list
app.put('/api/price-lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const db = await getDB();
    await db.read();
    
    const priceListIndex = db.data.priceLists?.findIndex(list => list.id === id);
    
    if (priceListIndex === -1) {
      return res.status(404).json({ error: 'Price list not found' });
    }
    
    // Update the price list
    db.data.priceLists[priceListIndex] = {
      ...db.data.priceLists[priceListIndex],
      ...updateData,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };
    
    await db.write();
    
    console.log(`Updated price list: ${id}`);
    res.json(db.data.priceLists[priceListIndex]);
  } catch (error) {
    console.error('Error updating price list:', error);
    res.status(500).json({ 
      error: 'Failed to update price list',
      message: error.message 
    });
  }
});

// Delete price list
app.delete('/api/price-lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = await getDB();
    await db.read();
    
    const priceListIndex = db.data.priceLists?.findIndex(list => list.id === id);
    
    if (priceListIndex === -1) {
      return res.status(404).json({ error: 'Price list not found' });
    }
    
    const deletedList = db.data.priceLists.splice(priceListIndex, 1)[0];
    await db.write();
    
    console.log(`Deleted price list: ${deletedList.name}`);
    res.json({ 
      success: true,
      message: 'Price list deleted successfully',
      deletedList: { id: deletedList.id, name: deletedList.name }
    });
  } catch (error) {
    console.error('Error deleting price list:', error);
    res.status(500).json({ 
      error: 'Failed to delete price list',
      message: error.message 
    });
  }
});

// Export price list to PDF
app.post('/api/price-lists/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.body; // 'pdf', 'csv', 'json'
    
    const db = await getDB();
    await db.read();
    
    const priceList = db.data.priceLists?.find(list => list.id === id);
    
    if (!priceList) {
      return res.status(404).json({ error: 'Price list not found' });
    }
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="price-list-${priceList.name}.json"`);
      return res.json(priceList);
    }
    
    if (format === 'csv') {
      const csvContent = generateCSV(priceList);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="price-list-${priceList.name}.csv"`);
      return res.send(csvContent);
    }
    
    // Default to PDF
    const pdfContent = generatePDFContent(priceList);
    res.setHeader('Content-Type', 'text/html');
    res.send(pdfContent);
    
  } catch (error) {
    console.error('Error exporting price list:', error);
    res.status(500).json({ 
      error: 'Failed to export price list',
      message: error.message 
    });
  }
});

// ===========================================
// DOCUMENT IMPORT ROUTES (Renamed from quote processing)
// ===========================================

// Upload document for processing
app.post('/api/documents/upload', upload.single('documentFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const documentName = req.body.documentName || 'Imported Price List';
    
    const documentId = Date.now().toString();
    const documentInfo = {
      id: documentId,
      name: documentName,
      originalName: req.file.originalname,
      filePath: filePath,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
      fileInfo: {
        type: req.file.mimetype,
        size: req.file.size
      },
      products: []
    };
    
    const db = await getDB();
    await db.read();
    
    if (!db.data.documents) db.data.documents = [];
    db.data.documents.push(documentInfo);
    await db.write();
    
    // Start processing in background
    processDocumentInBackground(documentId, filePath, req.file.mimetype);
    
    res.status(201).json({ 
      message: 'Document uploaded successfully',
      document: documentInfo
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Document upload failed', message: error.message });
  }
});

// Get processed document
app.get('/api/documents/:id', async (req, res) => {
  try {
    const documentId = req.params.id;
    
    const db = await getDB();
    await db.read();
    
    const document = db.data.documents?.find(doc => doc.id === documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({
      id: document.id,
      name: document.name,
      products: document.products || [],
      status: document.status || 'processing',
      processingComplete: document.status === 'processed',
      uploadedAt: document.uploadedAt,
      processedAt: document.processedAt
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document', message: error.message });
  }
});

// Create price list from processed document
app.post('/api/documents/:id/create-price-list', async (req, res) => {
  try {
    const documentId = req.params.id;
    const { name, selectedProducts, settings, companyInfo } = req.body;
    
    const db = await getDB();
    await db.read();
    
    const document = db.data.documents?.find(doc => doc.id === documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (document.status !== 'processed') {
      return res.status(400).json({ error: 'Document has not been processed yet' });
    }
    
    // Use selected products or all products from document
    const products = selectedProducts || document.products || [];
    
    if (products.length === 0) {
      return res.status(400).json({ error: 'No products available to create price list' });
    }
    
    // Create the new price list
    const newPriceList = {
      id: Date.now().toString(),
      name: name || `Price List from ${document.name}`,
      products: products,
      template: 'default',
      settings: {
        currency: 'USD',
        showImages: true,
        showDescriptions: true,
        groupByCategory: false,
        ...settings
      },
      companyInfo: {
        name: 'Your Company',
        email: 'contact@company.com',
        phone: '+1 (555) 123-4567',
        website: 'https://yourcompany.com',
        ...companyInfo
      },
      sourceDocument: documentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (!db.data.priceLists) db.data.priceLists = [];
    db.data.priceLists.push(newPriceList);
    await db.write();
    
    console.log(`Created price list from document: ${newPriceList.name} with ${products.length} products`);
    res.status(201).json(newPriceList);
  } catch (error) {
    console.error('Error creating price list from document:', error);
    res.status(500).json({ 
      error: 'Failed to create price list from document',
      message: error.message 
    });
  }
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

// Background document processing
async function processDocumentInBackground(documentId, filePath, mimeType) {
  try {
    console.log(`Starting background processing for document ${documentId}...`);
    
    const db = await getDB();
    await db.read();
    
    const documentIndex = db.data.documents?.findIndex(doc => doc.id === documentId);
    
    if (documentIndex === -1) {
      console.error(`Document ${documentId} not found in database`);
      return;
    }
    
    db.data.documents[documentIndex].status = 'processing';
    await db.write();
    
    // Process with Claude
    const extractedProducts = await processQuoteWithClaude(filePath);
    
    console.log(`Extraction completed for document ${documentId}. Found ${extractedProducts.length} products.`);
    
    // Update database with results
    await db.read();
    const updatedDocumentIndex = db.data.documents?.findIndex(doc => doc.id === documentId);
    
    if (updatedDocumentIndex !== -1) {
      db.data.documents[updatedDocumentIndex].status = extractedProducts.length > 0 ? 'processed' : 'error';
      db.data.documents[updatedDocumentIndex].processedAt = new Date().toISOString();
      db.data.documents[updatedDocumentIndex].products = extractedProducts;
      
      await db.write();
      console.log(`Document ${documentId} processing completed and saved to database`);
    }
    
  } catch (error) {
    console.error(`Background processing error for document ${documentId}:`, error);
    
    try {
      const db = await getDB();
      await db.read();
      
      const documentIndex = db.data.documents?.findIndex(doc => doc.id === documentId);
      if (documentIndex !== -1) {
        db.data.documents[documentIndex].status = 'error';
        db.data.documents[documentIndex].error = error.message;
        await db.write();
      }
    } catch (dbError) {
      console.error(`Failed to update document status after error:`, dbError);
    }
  }
}

// Generate CSV content
function generateCSV(priceList) {
  const headers = ['SKU', 'Product Name', 'Description', 'Price', 'Category'];
  const rows = priceList.products.map(product => [
    product.sku || '',
    product.title || product.name || '',
    product.description || '',
    product.price || product.unitPrice || '0.00',
    product.product_type || product.category || ''
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  return csvContent;
}

// Generate PDF HTML content
function generatePDFContent(priceList) {
  const { companyInfo, products, settings } = priceList;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${priceList.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          line-height: 1.5; 
          color: #111827; 
          background: white; 
        }
        @media print { 
          @page { margin: 0.5in; size: A4; } 
          body { -webkit-print-color-adjust: exact; } 
        }
        .header { 
          background: linear-gradient(135deg, #1e293b 0%, #1e40af 100%); 
          color: white; 
          padding: 2rem; 
          margin-bottom: 2rem;
        }
        .company-info { display: flex; justify-content: space-between; align-items: center; }
        .company-name { font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; }
        .list-title { font-size: 1.5rem; margin-top: 1rem; }
        .products-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
          gap: 1.5rem; 
          padding: 0 2rem;
        }
        .product-card { 
          border: 2px solid #e5e7eb; 
          border-radius: 12px; 
          padding: 1.5rem; 
          break-inside: avoid;
        }
        .product-title { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem; }
        .product-price { font-size: 1.5rem; font-weight: bold; color: #1e40af; margin-top: 1rem; }
        .footer { 
          background: #1e293b; 
          color: white; 
          padding: 2rem; 
          margin-top: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .contact-info { display: flex; flex-direction: column; gap: 0.5rem; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <div>
            <div class="company-name">${companyInfo.name}</div>
            <div>${companyInfo.email} • ${companyInfo.phone}</div>
            <div class="list-title">${priceList.name}</div>
          </div>
        </div>
      </div>
      
      <div class="products-grid">
        ${products.map(product => `
          <div class="product-card">
            <div class="product-title">${product.title || product.name || product.description || 'Product'}</div>
            ${product.sku ? `<div>SKU: ${product.sku}</div>` : ''}
            ${product.description && product.description !== product.title ? `<div>${product.description}</div>` : ''}
            <div class="product-price">${settings.currency || '$'}${(product.price || product.unitPrice || 0).toFixed ? (product.price || product.unitPrice || 0).toFixed(2) : (product.price || product.unitPrice || '0.00')}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="footer">
        <div class="contact-info">
          <div>📞 ${companyInfo.phone}</div>
          <div>✉️ ${companyInfo.email}</div>
          <div>🌐 ${companyInfo.website}</div>
        </div>
        <div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(companyInfo.website || 'https://example.com')}" alt="QR Code" style="width: 80px; height: 80px;">
        </div>
      </div>
      
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 1000);
        };
      </script>
    </body>
    </html>
  `;
}

// Get templates
app.get('/api/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'default',
        name: 'Default Template',
        description: 'Clean, professional layout with company branding',
        preview: '/images/template-default.png'
      },
      {
        id: 'modern',
        name: 'Modern Template', 
        description: 'Contemporary design with gradients and bold typography',
        preview: '/images/template-modern.png'
      },
      {
        id: 'minimal',
        name: 'Minimal Template',
        description: 'Simple, clean layout focusing on products',
        preview: '/images/template-minimal.png'
      }
    ];
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch templates',
      message: error.message 
    });
  }
});

// ===========================================
// ERROR HANDLING & FALLBACKS
// ===========================================

// Handle 404s
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.path
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong on the server',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ===========================================
// SERVER STARTUP
// ===========================================

async function startServer() {
  try {
    // Initialize database
    await initDB();
    console.log('✅ Database initialized');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Price List Generator running on port ${PORT}`);
      console.log(`📁 Serving static files from: ${publicPath}`);
      console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⚡ Ready to generate professional price lists!`);
      
      // Log available routes
      console.log('\n📋 Available routes:');
      console.log('  🏠 GET  /                    - Home page');
      console.log('  📝 GET  /create-price-list   - Create new price list');
      console.log('  📋 GET  /my-price-lists      - View saved price lists');
      console.log('  📄 GET  /import-document     - Import existing price list');
      console.log('  🛠️ GET  /templates           - Manage templates');
      console.log('  📦 GET  /api/products        - Get Shopify products');
      console.log('  📋 GET  /api/price-lists     - Get saved price lists');
      console.log('  📄 POST /api/documents/upload - Upload document for processing');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
