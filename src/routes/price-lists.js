// src/routes/price-lists.js (Updated with PDF generation)
import express from 'express';
import { getDB } from '../services/database.js';
import { generatePriceLisPDF } from '../services/pdfGenerator.js';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Get all price lists
router.get('/', async (req, res) => {
  try {
    const db = await getDB();
    await db.read();
    res.json({
      success: true,
      priceLists: db.data.priceLists || []
    });
  } catch (error) {
    console.error('Error fetching price lists:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch price lists',
      error: error.message
    });
  }
});

// Create new price list
router.post('/', async (req, res) => {
  try {
    const { name, products, settings, company } = req.body;
    const db = await getDB();
    await db.read();
    
    const newPriceList = {
      id: Date.now().toString(),
      name,
      products,
      settings,
      company,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (!db.data.priceLists) db.data.priceLists = [];
    db.data.priceLists.push(newPriceList);
    await db.write();
    
    res.status(201).json({
      success: true,
      priceList: newPriceList,
      message: 'Price list created successfully'
    });
  } catch (error) {
    console.error('Error creating price list:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create price list',
      error: error.message
    });
  }
});

// Generate PDF from price list data
router.post('/generate-pdf', async (req, res) => {
  try {
    console.log('🎯 Starting PDF generation...');
    const { title, currency, products, company, timestamp } = req.body;

    // Validate required data
    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No products provided for PDF generation'
      });
    }

    // Prepare data for PDF generation
    const pdfData = {
      title: title || 'Product Catalog',
      currency: currency || 'ZAR',
      products: products.map(product => ({
        id: product.id,
        title: product.title,
        vendor: product.vendor || 'Unknown Vendor',
        productType: product.productType || 'Uncategorized',
        price: product.variants?.[0]?.price || '0.00',
        sku: product.variants?.[0]?.sku || '',
        image: product.featuredImage?.url || '',
        description: product.description || ''
      })),
      company: {
        name: company.name || 'Your Company',
        email: company.email || 'sales@company.com',
        phone: company.phone || '+27 11 123 4567',
        website: company.website || 'https://yourstore.com',
        terms: company.terms || 'Payment terms are COD. T\'s & C\'s Apply.'
      },
      generatedAt: timestamp || new Date().toISOString()
    };

    console.log(`📋 Generating PDF for ${products.length} products...`);

    // Generate PDF
    const pdfResult = await generatePriceLisPDF(pdfData);

    if (pdfResult.success) {
      // Save price list to database
      const db = await getDB();
      await db.read();
      
      const newPriceList = {
        id: Date.now().toString(),
        name: pdfData.title,
        products: pdfData.products,
        company: pdfData.company,
        settings: { currency: pdfData.currency },
        pdfPath: pdfResult.filePath,
        createdAt: pdfData.generatedAt,
        updatedAt: pdfData.generatedAt
      };
      
      if (!db.data.priceLists) db.data.priceLists = [];
      db.data.priceLists.push(newPriceList);
      await db.write();

      console.log('✅ PDF generated successfully:', pdfResult.filePath);

      res.json({
        success: true,
        message: 'PDF generated successfully',
        downloadUrl: pdfResult.downloadUrl,
        fileName: pdfResult.fileName,
        priceListId: newPriceList.id
      });
    } else {
      throw new Error(pdfResult.error || 'PDF generation failed');
    }

  } catch (error) {
    console.error('❌ PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message
    });
  }
});

router.post('/save', async (req, res) => {
  try {
    const priceListData = req.body;
    // Save to your database (LowDB)
    const savedPriceList = await savePriceListToDB(priceListData);
    res.json(savedPriceList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-pdf', async (req, res) => {
  try {
    const { priceListData, companyInfo, customerTier } = req.body;
    
    // Import your PDF generator
    const { generateEnhancedPDF } = await import('../utils/PriceListPDFGenerator.js');
    
    const pdfBuffer = await generateEnhancedPDF(companyInfo, priceListData.products, customerTier);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="price-list.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download PDF file
router.get('/download/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const filePath = path.join(process.cwd(), 'generated', fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'PDF file not found'
      });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download PDF',
      error: error.message
    });
  }
});

// Get specific price list
router.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.read();
    
    const priceList = db.data.priceLists?.find(pl => pl.id === req.params.id);
    
    if (!priceList) {
      return res.status(404).json({
        success: false,
        message: 'Price list not found'
      });
    }

    res.json({
      success: true,
      priceList: priceList
    });
  } catch (error) {
    console.error('Error fetching price list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch price list',
      error: error.message
    });
  }
});

router.get('/products', async (req, res) => {
  try {
    const { session } = req.query;
    // Fetch products from Shopify API
    const products = await fetchShopifyProducts(session);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/saved', async (req, res) => {
  try {
    const { shop } = req.query;
    const priceLists = await getSavedPriceLists(shop);
    res.json(priceLists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete price list
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.read();
    
    const priceListIndex = db.data.priceLists?.findIndex(pl => pl.id === req.params.id);
    
    if (priceListIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Price list not found'
      });
    }

    // Remove PDF file if it exists
    const priceList = db.data.priceLists[priceListIndex];
    if (priceList.pdfPath && fs.existsSync(priceList.pdfPath)) {
      fs.unlinkSync(priceList.pdfPath);
    }

    // Remove from database
    db.data.priceLists.splice(priceListIndex, 1);
    await db.write();

    res.json({
      success: true,
      message: 'Price list deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting price list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete price list',
      error: error.message
    });
  }
});

export default router;
