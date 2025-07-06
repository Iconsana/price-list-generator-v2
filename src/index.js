// Price List Generator - Main Server
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cookieParser from 'cookie-parser';

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

// Export page
app.get('/export', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'export.html'));
});

// ===========================================
// API ROUTES FOR PRICE LIST GENERATOR
// ===========================================

// Get products from Shopify (placeholder - will integrate with Shopify API)
app.get('/api/products', async (req, res) => {
  try {
    // TODO: Integrate with Shopify API
    // For now, return mock data to prevent errors
    const mockProducts = [
      {
        id: '1',
        title: 'Sample Product 1',
        price: '29.99',
        handle: 'sample-product-1',
        vendor: 'Sample Vendor',
        product_type: 'Electronics'
      },
      {
        id: '2', 
        title: 'Sample Product 2',
        price: '49.99',
        handle: 'sample-product-2',
        vendor: 'Sample Vendor',
        product_type: 'Electronics'
      }
    ];

    res.json(mockProducts);
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
    // TODO: Implement database storage for price lists
    // For now, return empty array to prevent errors
    const priceLists = [];
    
    res.json(priceLists);
  } catch (error) {
    console.error('Error fetching price lists:', error);
    res.status(500).json({ 
      error: 'Failed to fetch price lists',
      message: error.message 
    });
  }
});

// Create new price list
app.post('/api/price-lists', async (req, res) => {
  try {
    const { name, products, template, settings } = req.body;
    
    // TODO: Implement price list creation logic
    // For now, return success response
    const newPriceList = {
      id: Date.now().toString(),
      name: name || 'Untitled Price List',
      products: products || [],
      template: template || 'default',
      settings: settings || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
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
    
    // TODO: Implement price list update logic
    res.json({ 
      id,
      ...updateData,
      updatedAt: new Date().toISOString()
    });
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
    
    // TODO: Implement price list deletion logic
    res.json({ 
      success: true,
      message: 'Price list deleted successfully'
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
    
    // TODO: Implement export functionality
    res.json({ 
      success: true,
      downloadUrl: `/downloads/price-list-${id}.${format}`,
      message: 'Export generated successfully'
    });
  } catch (error) {
    console.error('Error exporting price list:', error);
    res.status(500).json({ 
      error: 'Failed to export price list',
      message: error.message 
    });
  }
});

// Get templates
app.get('/api/templates', async (req, res) => {
  try {
    // TODO: Implement template system
    const templates = [
      {
        id: 'default',
        name: 'Default Template',
        description: 'Clean, professional layout'
      },
      {
        id: 'branded',
        name: 'Branded Template', 
        description: 'Include your company logo and colors'
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
// SHOPIFY OAUTH INTEGRATION
// ===========================================

// OAuth callback route (preserve existing OAuth functionality)
app.get('/auth/callback', async (req, res) => {
  try {
    // TODO: Implement Shopify OAuth callback
    // For now, redirect to main app
    res.redirect('/');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('OAuth authentication failed');
  }
});

// Install route for Shopify app
app.get('/install', (req, res) => {
  try {
    // TODO: Implement Shopify app installation
    res.redirect('/');
  } catch (error) {
    console.error('Install error:', error);
    res.status(500).send('Installation failed');
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

app.listen(PORT, () => {
  console.log(`🚀 Price List Generator running on port ${PORT}`);
  console.log(`📁 Serving static files from: ${publicPath}`);
  console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Ready to generate professional price lists!`);
});

export default app;
