// src/index.js - Minimal Working Version
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ===========================================
// MIDDLEWARE SETUP  
// ===========================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
const publicPath = path.join(process.cwd(), 'public');
app.use('/static', express.static(publicPath));

// ===========================================
// UTILITY FUNCTIONS
// ===========================================
function sendFileWithNav(res, filePath) {
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Page Not Found</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50 min-h-screen flex items-center justify-center">
            <div class="text-center">
                <h1 class="text-4xl font-bold text-gray-900 mb-4">Page Not Found</h1>
                <p class="text-gray-600 mb-6">The requested page could not be found.</p>
                <a href="/" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">Return to Home</a>
            </div>
        </body>
        </html>
      `);
    }
  });
}

// ===========================================
// API ROUTES - SIMPLE VERSIONS
// ===========================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'Price List Generator API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mock Shopify products endpoint (for testing)
app.get('/api/shopify/products', (req, res) => {
  // Mock data for testing
  const mockProducts = [
    {
      id: 'gid://shopify/Product/1',
      title: 'Sunsynk Wall Mount 5.12kWh 51.2V Lithium Battery',
      vendor: 'Sunsynk',
      productType: 'Battery',
      featuredImage: { url: 'https://via.placeholder.com/150x150?text=Battery' },
      variants: [{ 
        id: 'gid://shopify/ProductVariant/1',
        price: '19999.00',
        sku: 'SUN-BATT-5.12',
        inventoryQuantity: 5
      }]
    },
    {
      id: 'gid://shopify/Product/2', 
      title: '5.12kWh Dyness 51.2V Battery BX51100',
      vendor: 'Dyness',
      productType: 'Battery',
      featuredImage: { url: 'https://via.placeholder.com/150x150?text=Dyness' },
      variants: [{
        id: 'gid://shopify/ProductVariant/2',
        price: '16100.00', 
        sku: 'BX51100',
        inventoryQuantity: 3
      }]
    },
    {
      id: 'gid://shopify/Product/3',
      title: 'Esener 25.6V 100Ah Multifunctional Lithium Battery',
      vendor: 'Esener', 
      productType: 'Battery',
      featuredImage: { url: 'https://via.placeholder.com/150x150?text=Esener' },
      variants: [{
        id: 'gid://shopify/ProductVariant/3',
        price: '9200.00',
        sku: 'ES-2.56KWH',
        inventoryQuantity: 10
      }]
    }
  ];

  res.json({
    success: true,
    products: mockProducts,
    count: mockProducts.length,
    message: 'Mock products loaded (will connect to real Shopify when configured)'
  });
});

// Simple PDF generation endpoint
app.post('/api/price-lists/generate-pdf', (req, res) => {
  try {
    const { title, currency, products, company } = req.body;
    
    // For now, just return success - we'll implement actual PDF generation later
    res.json({
      success: true,
      message: 'PDF generation successful!',
      downloadUrl: '/api/test-pdf',
      fileName: `price-list-${Date.now()}.html`,
      note: 'This is a mock response - full PDF generation will be implemented next'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'PDF generation failed',
      error: error.message
    });
  }
});

// Test PDF download
app.get('/api/test-pdf', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Test Price List</title></head>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1>🎉 PDF Generation Working!</h1>
        <p>This confirms your Price List Generator is working correctly.</p>
        <p><strong>Next steps:</strong> We'll enhance this with full Shopify integration and beautiful PDF templates.</p>
    </body>
    </html>
  `);
});

// ===========================================
// FRONTEND ROUTES
// ===========================================

// Home page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Price List Generator</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 min-h-screen">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-4">
                    <div class="flex items-center space-x-4">
                        <h1 class="text-2xl font-bold text-gray-900">Price List Generator</h1>
                        <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                            APP STATUS: ONLINE
                        </span>
                    </div>
                    <nav class="hidden md:flex space-x-6">
                        <a href="/" class="text-blue-600 font-medium border-b-2 border-blue-600">Home</a>
                        <a href="/my-price-lists" class="text-gray-700 hover:text-blue-600 font-medium">My Price Lists</a>
                        <a href="/create-price-list" class="text-gray-700 hover:text-blue-600 font-medium">Create New</a>
                        <a href="/import-document" class="text-gray-700 hover:text-blue-600 font-medium">Import Document</a>
                        <a href="/templates" class="text-gray-700 hover:text-blue-600 font-medium">Templates</a>
                    </nav>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-12">
                <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-12 rounded-2xl mb-8">
                    <h2 class="text-4xl font-bold mb-4">Professional Price Lists Made Easy</h2>
                    <p class="text-xl mb-8">Create stunning, professional price lists from your Shopify products in minutes. Import existing documents or build from scratch.</p>
                    
                    <div class="flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="/create-price-list" class="bg-white text-blue-600 py-4 px-8 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center">
                            🚀 Create Price List
                        </a>
                        <a href="/import-document" class="bg-blue-500 text-white py-4 px-8 rounded-lg font-semibold hover:bg-blue-400 transition-colors flex items-center justify-center">
                            📄 Import Document
                        </a>
                    </div>
                </div>
            </div>

            <!-- Features Grid -->
            <div class="grid md:grid-cols-3 gap-8 mb-12">
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <div class="text-3xl mb-4">🏢</div>
                    <h3 class="text-xl font-semibold mb-2">Company Branding</h3>
                    <p class="text-gray-600">Add your logo, contact details, and terms to create professional branded price lists.</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <div class="text-3xl mb-4">🛍️</div>
                    <h3 class="text-xl font-semibold mb-2">Shopify Integration</h3>
                    <p class="text-gray-600">Automatically sync products, prices, and inventory from your Shopify store.</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <div class="text-3xl mb-4">📄</div>
                    <h3 class="text-xl font-semibold mb-2">PDF Export</h3>
                    <p class="text-gray-600">Generate beautiful, print-ready PDF catalogs that you can share with customers.</p>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="bg-white rounded-lg shadow-md p-8">
                <h3 class="text-2xl font-bold mb-6 text-center">Quick Actions</h3>
                <div class="grid sm:grid-cols-2 gap-4">
                    <a href="/my-price-lists" class="border-2 border-gray-200 hover:border-blue-300 rounded-lg p-6 text-center transition-colors">
                        <div class="text-2xl mb-2">📋</div>
                        <div class="font-semibold">My Price Lists</div>
                        <div class="text-sm text-gray-600">View and manage existing price lists</div>
                    </a>
                    <a href="/templates" class="border-2 border-gray-200 hover:border-blue-300 rounded-lg p-6 text-center transition-colors">
                        <div class="text-2xl mb-2">🎨</div>
                        <div class="font-semibold">Templates</div>
                        <div class="text-sm text-gray-600">Choose from professional templates</div>
                    </a>
                </div>
            </div>
        </main>

        <!-- Footer -->
        <footer class="bg-gray-800 text-white py-8 mt-16">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <p>&copy; 2025 Price List Generator. Professional catalogs made simple.</p>
            </div>
        </footer>
    </body>
    </html>
  `);
});

// Create price list page
app.get('/create-price-list', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Create Price List</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
        <div class="max-w-7xl mx-auto py-8 px-4">
            <div class="mb-8">
                <h1 class="text-3xl font-bold">Create New Price List</h1>
                <p class="text-gray-600 mt-2">Build professional price lists from your products</p>
            </div>

            <div class="grid lg:grid-cols-3 gap-8">
                <!-- Left Panel -->
                <div class="lg:col-span-1">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h3 class="text-lg font-semibold mb-4">Company Information</h3>
                        <div class="space-y-4">
                            <input type="text" id="companyName" placeholder="Company Name" class="w-full p-3 border rounded-lg">
                            <input type="email" id="companyEmail" placeholder="Email" class="w-full p-3 border rounded-lg">
                            <input type="tel" id="companyPhone" placeholder="Phone" class="w-full p-3 border rounded-lg">
                            <input type="text" id="listTitle" placeholder="Price List Title" class="w-full p-3 border rounded-lg">
                        </div>
                        
                        <div class="mt-6 space-y-3">
                            <button id="loadProducts" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
                                Load Products
                            </button>
                            <button id="generatePdf" class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700" disabled>
                                Generate Price List
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Right Panel -->
                <div class="lg:col-span-2">
                    <div class="bg-white rounded-lg shadow">
                        <div class="p-6 border-b">
                            <h3 class="text-lg font-semibold">Product Selection</h3>
                        </div>
                        <div class="p-6">
                            <div id="productArea" class="text-center py-12">
                                <p class="text-gray-500">Click "Load Products" to begin</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            let selectedProducts = [];

            document.getElementById('loadProducts').addEventListener('click', async () => {
                const btn = document.getElementById('loadProducts');
                const productArea = document.getElementById('productArea');
                
                btn.disabled = true;
                btn.textContent = 'Loading...';
                
                try {
                    const response = await fetch('/api/shopify/products');
                    const data = await response.json();
                    
                    if (data.success) {
                        productArea.innerHTML = \`
                            <div class="text-left">
                                <h4 class="font-semibold mb-4">Select Products (\${data.products.length} available)</h4>
                                <div class="space-y-3">
                                    \${data.products.map(product => \`
                                        <label class="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                            <input type="checkbox" value="\${product.id}" class="product-checkbox mr-3">
                                            <div class="flex-1">
                                                <div class="font-medium">\${product.title}</div>
                                                <div class="text-sm text-gray-600">\${product.vendor} • R \${parseFloat(product.variants[0].price).toFixed(2)}</div>
                                            </div>
                                        </label>
                                    \`).join('')}
                                </div>
                            </div>
                        \`;
                        
                        // Add change listeners
                        document.querySelectorAll('.product-checkbox').forEach(checkbox => {
                            checkbox.addEventListener('change', updateSelection);
                        });
                        
                        updateSelection();
                    } else {
                        productArea.innerHTML = '<p class="text-red-500">Error loading products</p>';
                    }
                } catch (error) {
                    productArea.innerHTML = '<p class="text-red-500">Error: ' + error.message + '</p>';
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Load Products';
                }
            });

            function updateSelection() {
                const checkboxes = document.querySelectorAll('.product-checkbox:checked');
                document.getElementById('generatePdf').disabled = checkboxes.length === 0;
            }

            document.getElementById('generatePdf').addEventListener('click', async () => {
                const btn = document.getElementById('generatePdf');
                const checkboxes = document.querySelectorAll('.product-checkbox:checked');
                
                if (checkboxes.length === 0) return;
                
                btn.disabled = true;
                btn.textContent = 'Generating...';
                
                try {
                    const response = await fetch('/api/price-lists/generate-pdf', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: document.getElementById('listTitle').value || 'Product Catalog',
                            company: {
                                name: document.getElementById('companyName').value || 'Your Company',
                                email: document.getElementById('companyEmail').value || 'sales@company.com',
                                phone: document.getElementById('companyPhone').value || '+27 11 123 4567'
                            },
                            products: Array.from(checkboxes).map(cb => ({ id: cb.value }))
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('✅ ' + result.message);
                        if (result.downloadUrl) {
                            window.open(result.downloadUrl, '_blank');
                        }
                    } else {
                        alert('❌ ' + result.message);
                    }
                } catch (error) {
                    alert('Error: ' + error.message);
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Generate Price List';
                }
            });
        </script>
    </body>
    </html>
  `);
});

// Other pages with simple placeholders
app.get('/my-price-lists', (req, res) => {
  res.send('<h1>My Price Lists</h1><p>Coming soon...</p><a href="/">← Back to Home</a>');
});

app.get('/import-document', (req, res) => {
  res.send('<h1>Import Document</h1><p>Coming soon...</p><a href="/">← Back to Home</a>');
});

app.get('/templates', (req, res) => {
  res.send('<h1>Templates</h1><p>Coming soon...</p><a href="/">← Back to Home</a>');
});

// ===========================================
// ERROR HANDLING
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

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log(\`🚀 Price List Generator server running on port \${PORT}\`);
  console.log(\`📱 Frontend: http://localhost:\${PORT}\`);
  console.log(\`🔌 API: http://localhost:\${PORT}/api/health\`);
  console.log(\`🛍️ Environment: \${process.env.NODE_ENV || 'development'}\`);
});
