// Storage Service - Handles price list storage and management
export class StorageService {
  constructor() {
    this.priceLists = new Map();
    this.nextId = 1;
  }

  // Save a price list
  savePriceList(priceList) {
    const id = priceList.id || this.generateId();
    const timestamp = new Date().toISOString();
    
    const savedList = {
      id,
      ...priceList,
      createdAt: priceList.createdAt || timestamp,
      updatedAt: timestamp
    };
    
    this.priceLists.set(id, savedList);
    return savedList;
  }

  // Get a price list by ID
  getPriceList(id) {
    return this.priceLists.get(id);
  }

  // Get all price lists
  getAllPriceLists() {
    return Array.from(this.priceLists.values())
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  // Delete a price list
  deletePriceList(id) {
    return this.priceLists.delete(id);
  }

  // Update a price list
  updatePriceList(id, updates) {
    const existing = this.priceLists.get(id);
    if (!existing) {
      throw new Error(`Price list with ID ${id} not found`);
    }
    
    const updated = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };
    
    this.priceLists.set(id, updated);
    return updated;
  }

  // Search price lists
  searchPriceLists(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAllPriceLists().filter(list => 
      list.name?.toLowerCase().includes(lowerQuery) ||
      list.clientName?.toLowerCase().includes(lowerQuery) ||
      list.pricingTier?.toLowerCase().includes(lowerQuery)
    );
  }

  // Get price lists by client
  getPriceListsByClient(clientName) {
    return this.getAllPriceLists().filter(list => 
      list.clientName?.toLowerCase() === clientName.toLowerCase()
    );
  }

  // Get price lists by tier
  getPriceListsByTier(tier) {
    return this.getAllPriceLists().filter(list => 
      list.pricingTier === tier
    );
  }

  // Generate unique ID
  generateId() {
    return `pl_${Date.now()}_${this.nextId++}`;
  }

  // Get statistics
  getStatistics() {
    const lists = this.getAllPriceLists();
    const totalLists = lists.length;
    
    const tierCounts = lists.reduce((acc, list) => {
      acc[list.pricingTier] = (acc[list.pricingTier] || 0) + 1;
      return acc;
    }, {});
    
    const recentLists = lists.filter(list => {
      const daysSinceUpdate = (Date.now() - new Date(list.updatedAt)) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate <= 7;
    }).length;
    
    return {
      totalLists,
      tierCounts,
      recentLists,
      oldestList: lists.length > 0 ? lists[lists.length - 1] : null,
      newestList: lists.length > 0 ? lists[0] : null
    };
  }

  // Export data (for backup/migration)
  exportData() {
    return {
      priceLists: Array.from(this.priceLists.entries()),
      nextId: this.nextId,
      exportedAt: new Date().toISOString()
    };
  }

  // Import data (for restore/migration)
  importData(data) {
    this.priceLists.clear();
    
    if (data.priceLists) {
      data.priceLists.forEach(([id, priceList]) => {
        this.priceLists.set(id, priceList);
      });
    }
    
    this.nextId = data.nextId || 1;
  }

  // Clear all data
  clear() {
    this.priceLists.clear();
    this.nextId = 1;
  }

  // Get size
  size() {
    return this.priceLists.size;
  }
}

// Create singleton instance
export const storageService = new StorageService();
export default storageService;