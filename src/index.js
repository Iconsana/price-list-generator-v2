// src/index.js (Updated for Price List Generator)
import express from 'express';
import session from 'express-session';
import { join } from 'path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

// Import route handlers
import priceListRoutes from './routes/price-lists.js';
import shopifyRoutes from './routes/shopify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ===========================================
// MIDDLEWARE SETUP
// ===========================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'price-list-generator-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static files
const publicPath = path.join(process.cwd(), 'public');
app.use('/static', express.static(publicPath));
app.use('/generated', express.static(path.join(process.cwd(), 'generated')));

// ===========================================
// DATABASE INITIALIZATION
// ===========================================
const file = join(process.cwd(), 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter, { 
  priceLists: [],
  settings: {},
  sessions: {}
});

// Initialize database
await db.read();
if (!db.data) {
  db.data = { 
    priceLists: [],
    settings: {},
    sessions: {}
  };
  await db.write();
}

// Make db available globally
app.locals.db = db;

// ===========================================
// UTILITY FUNCTIONS
// ===========================================
function sendFileWithNav(res, filePath) {
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(404).send(`
        <html>
          <head><title>Page Not Found</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Page Not Found</h1>
            <p>The requested page could not be found.</p>
            <a href="/" style="color: blue; text-decoration: underline;">Return to Home</a>
          </body>
        </html>
      `);
    }
  });
}

// ===========================================
// API ROUTES
// ===========================================

// Mount API routes
app.use('/api/price-lists', priceListRoutes);
app.use('/api/shopify', shopifyRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'Price List Generator API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test connection endpoint
app.get('/api/test-connection', (req, res) => {
  res.json({
    status: 'success',
    message: 'API connection successful',
    time: new Date().toISOString()
  });
});

// ===========================================
// FRONTEND ROUTES (HTML PAGES)
// ===========================================

// Home page
app.get('/', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    sendFileWithNav(res, indexPath);
  } else {
    // Fallback home page
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Price List Generator</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50">
          <div class="min-h-screen flex items-center justify-center">
              <div class="max-w-md w-full space-y-8 p-8">
                  <div class="text-center">
                      <h1 class="text-4xl font-bold text-gray-900 mb-4">Price List Generator</h1>
                      <div class="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-8">
                          APP STATUS: ONLINE
                      </div>
                      
                      <div class="bg-blue-600 text-white p-8 rounded-lg mb-8">
                          <h2 class="text-2xl font-bold mb-4">Professional Price Lists Made Easy</h2>
                          <p class="mb-6">Create stunning, professional price lists from your Shopify products in minutes.</p>
                          
                          <div class="space-y-4">
                              <a href="/create-price-list" class="w-full bg-white text-blue-600 py-3 px-6 rounded-lg font-semibold hover:bg-gray-100 transition-colors block">
                                  🚀 Create Price List
                              </a>
                              <a href="/my-price-lists" class="w-full bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-400 transition-colors block">
                                  📋 My Price Lists
                              </a>
                          </div>
                      </div>
                      
                      <nav class="flex justify-center space-x-6 text-sm">
                          <a href="/import-document" class="text-gray-600 hover:text-blue-600">Import Document</a>
                          <a href="/templates" class="text-gray-600 hover:text-blue-600">Templates</a>
                          <a href="/api/health" class="text-gray-600 hover:text-blue-600">API Status</a>
                      </nav>
                  </div>
              </div>
          </div>
      </body>
      </html>
    `);
  }
});

// Create new price list page
app.get('/create-price-list', (req, res) => {
  const createPath = path.join(publicPath, 'create-price-list.html');
  if (require('fs').existsSync(createPath)) {
    sendFileWithNav(res, createPath);
  } else {
    res.redirect('/');
  }
});

// My price lists page
app.get('/my-price-lists', (req, res) => {
  const myListsPath = path.join(publicPath, 'my-price-lists.html');
  if (require('fs').existsSync(myListsPath)) {
    sendFileWithNav(res, myListsPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>My Price Lists</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50">
          <div class="max-w-7xl mx-auto py-8 px-4">
              <div class="flex justify-between items-center mb-8">
                  <h1 class="text-3xl font-bold">My Price Lists</h1>
                  <a href="/create-price-list" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                      Create New
                  </a>
              </div>
              
              <div id="priceListsContainer" class="grid gap-6">
                  <div class="text-center py-12">
                      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p class="text-gray-600">Loading your price lists...</p>
                  </div>
              </div>
          </div>
          
          <script>
              // Load price lists
              fetch('/api/price-lists')
                  .then(response => response.json())
                  .then(data => {
                      const container = document.getElementById('priceListsContainer');
                      if (data.success && data.priceLists.length > 0) {
                          container.innerHTML = data.priceLists.map(list => \`
                              <div class="bg-white p-6 rounded-lg shadow border">
                                  <h3 class="text-xl font-semibold mb-2">\${list.name}</h3>
                                  <p class="text-gray-600 mb-4">\${list.products.length} products</p>
                                  <p class="text-sm text-gray-500 mb-4">Created: \${new Date(list.createdAt).toLocaleDateString()}</p>
                                  <div class="flex space-x-2">
                                      <a href="/api/price-lists/download/\${list.fileName || 'price-list.html'}" 
                                         class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" 
                                         target="_blank">
                                          View/Download
                                      </a>
                                  </div>
                              </div>
                          \`).join('');
                      } else {
                          container.innerHTML = \`
                              <div class="text-center py-12">
                                  <p class="text-gray-600 mb-4">No price lists found</p>
                                  <a href="/create-price-list" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                                      Create Your First Price List
                                  </a>
                              </div>
                          \`;
                      }
                  })
                  .catch(error => {
                      console.error('Error loading price lists:', error);
                      document.getElementById('priceListsContainer').innerHTML = \`
                          <div class="text-center py-12">
                              <p class="text-red-600">Error loading price lists</p>
                              <a href="/" class="text-blue-600 underline">Return to Home</a>
                          </div>
                      \`;
                  });
          </script>
      </body>
      </html>
    `);
  }
});

// Import document page
app.get('/import-document', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Import Document - Price List Generator</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
        <div class="max-w-4xl mx-auto py-8 px-4">
            <div class="mb-8">
                <h1 class="text-3xl font-bold mb-2">Import Document</h1>
                <p class="text-gray-600">Upload existing price lists or product catalogs</p>
            </div>
            
            <div class="bg-white p-8 rounded-lg shadow">
                <div class="text-center py-12">
                    <div class="mb-6">
                        <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-semibold mb-2">Document Import Coming Soon</h3>
                    <p class="text-gray-600 mb-6">We're working on adding support for importing existing price lists, PDFs, and Excel files.</p>
                    <a href="/create-price-list" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                        Create New Price List Instead
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Templates page
app.get('/templates', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Templates - Price List Generator</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
        <div class="max-w-4xl mx-auto py-8 px-4">
            <div class="mb-8">
                <h1 class="text-3xl font-bold mb-2">Price List Templates</h1>
                <p class="text-gray-600">Professional templates for your price lists</p>
            </div>
            
            <div class="grid md:grid-cols-2 gap-6">
                <div class="bg-white p-6 rounded-lg shadow border">
                    <h3 class="text-xl font-semibold mb-4">Professional Template</h3>
                    <p class="text-gray-600 mb-4">Clean, modern design with company branding and product details</p>
                    <div class="bg-gray-100 p-4 rounded mb-4">
                        <div class="text-sm text-gray-600">Features:</div>
                        <ul class="text-sm text-gray-600 mt-2 space-y-1">
                            <li>• Company logo and branding</li>
                            <li>• Product images and descriptions</li>
                            <li>• Pricing with currency support</li>
                            <li>• Terms and conditions</li>
                        </ul>
                    </div>
                    <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">Currently Active</span>
                </div>
                
                <div class="bg-white p-6 rounded-lg shadow border opacity-60">
                    <h3 class="text-xl font-semibold mb-4">Minimalist Template</h3>
                    <p class="text-gray-600 mb-4">Simple, clean design focused on products and pricing</p>
                    <div class="bg-gray-100 p-4 rounded mb-4">
                        <div class="text-sm text-gray-600">Coming Soon</div>
                    </div>
                    <span class="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">Coming Soon</span>
                </div>
            </div>
            
            <div class="mt-8 text-center">
                <a href="/create-price-list" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                    Create Price List with Current Template
                </a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// ===========================================
// SHOPIFY OAUTH ROUTES (Existing)
// ===========================================

// OAuth callback (existing functionality)
app.get('/api/auth/callback', async (req, res) => {
  // This would handle Shopify OAuth callback
  // For now, redirect to app
  res.redirect('/');
});

// ===========================================
// ERROR HANDLING & FALLBACKS
// ===========================================

// 404 handler
app.use((req, res) => {
  res.status(404).send(`
    <html>
      <head><title>Page Not Found</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>Page Not Found</h1>
        <p>The requested page could not be found.</p>
        <a href="/" style="color: blue; text-decoration: underline;">Return to Home</a>
      </body>
    </html>
  `);
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log(`🚀 Price List Generator server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api/health`);
  console.log(`🛍️ Environment: ${process.env.NODE_ENV || 'development'}`);
});
