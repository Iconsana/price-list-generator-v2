// ✅ Match your exact ES module pattern
import express from 'express';
import { getDB } from '../services/database.js';

const router = express.Router();

// Get all price lists
router.get('/', async (req, res) => {
  try {
    const db = await getDB();
    await db.read();
    res.json(db.data.priceLists || []);
  } catch (error) {
    console.error('Error fetching price lists:', error);
    res.status(500).json({ error: 'Failed to fetch price lists' });
  }
});

// Create new price list
router.post('/', async (req, res) => {
  try {
    const { name, products, settings } = req.body;
    const db = await getDB();
    await db.read();
    
    const newPriceList = {
      id: Date.now().toString(),
      name,
      products,
      settings,
      createdAt: new Date().toISOString()
    };
    
    if (!db.data.priceLists) db.data.priceLists = [];
    db.data.priceLists.push(newPriceList);
    await db.write();
    
    res.status(201).json(newPriceList);
  } catch (error) {
    console.error('Error creating price list:', error);
    res.status(500).json({ error: 'Failed to create price list' });
  }
});

export default router;