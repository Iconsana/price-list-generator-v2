# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon  
- `npm run build` - No build step required (returns success message)
- `npm test` - No tests specified yet

## Project Architecture

This is a **Universal Price List Generator** - a Node.js/Express Shopify app that allows ANY business to create professional, branded price lists and catalogs. Currently deployed and working on Render with basic functionality. We are enhancing it with improved PDF aesthetics and innovative PDF-to-order conversion via QR codes.

### Core Components

**Main Application (`src/index.js`)**
- Single-file Express server with embedded ShopifyService class
- Handles both API endpoints and frontend routes
- Serves static HTML pages with embedded JavaScript
- Contains the main pricing calculation logic
- **NEW**: QR code generation endpoints
- **NEW**: Enhanced PDF export with clickable links

**Database Layer (`src/database.js`)**
- MongoDB connection using Mongoose
- Async connection handling with detailed error reporting
- Connection pooling and timeout configuration

### Current Working Features

**Pricing System** ✅
- **4 Pricing Tiers**: Retail (0%), Wholesale (15%), Installer (20%), Distributor (25%)
- **Custom Price Overrides**: Individual product pricing with visual indicators
- **Real-time Calculations**: Dynamic updates based on tier selections
- **Bulk Operations**: Apply tier pricing to selected products

**Basic PDF Generation** ✅
- **jsPDF Integration**: Working PDF export functionality
- **Product Information**: Name, specs, pricing in tabular format
- **Basic Formatting**: Simple layout with company info
- **Download Capability**: Direct PDF download to user device

**Shopify Integration** ✅
- **OAuth Authentication**: Working Shopify app authentication
- **GraphQL API**: Product fetching with search and pagination
- **Mock Data Fallback**: Functions without Shopify connection for testing
- **Product Filtering**: Search by name, vendor, category

### Planned Enhancements

**Enhanced PDF Aesthetics** 🔄
- **Professional Design**: Gradient headers, branded layout (like B|SHOCKED example)
- **Company vs Client Sections**: Left side your company, right side client details
- **Remove Fields**: Hide vendor and stock columns from client-facing PDFs
- **Clickable Links**: Product names link to store pages
- **Custom Branding**: Logo upload, taglines, contact information

**PDF-to-Order Innovation** 📋
- **QR Code Integration**: Generate QR codes that link to Shopify checkout
- **Draft Orders API**: Create Shopify draft orders with custom pricing
- **Time-Limited Pricing**: 30-day expiration on pricing offers
- **Instant Checkout**: Scan QR → Shopify checkout with exact pricing
- **Conversion Tracking**: Monitor which price lists become orders

### Implementation Status & Context

**✅ CURRENTLY WORKING (Deployed on Render)**
- Basic price list generation with jsPDF
- Shopify OAuth integration (Express + @shopify/shopify-api architecture)
- Product fetching via GraphQL with pagination
- Flexible pricing tiers: Retail (0%), Wholesale (15%), Installer (20%), Distributor (25%)
- Custom price overrides with visual indicators
- Basic PDF export functionality
- Mock data fallback when Shopify not connected
- Working deployment pipeline

**🔄 ENHANCEMENT IN PROGRESS (Safe Implementation Strategy)**
- Enhanced PDF aesthetics (professional design vs current basic layout)
- Company vs client details separation (currently generic)
- Remove vendor/stock fields from client-facing PDFs
- Make product links clickable in PDFs
- QR code generation for checkout workflows

**📋 PLANNED FEATURES (Draft Orders Integration)**
- Shopify Draft Orders API integration for PDF-to-order conversion
- Time-limited pricing with automatic expiration
- Customer reorder system from saved price lists
- Conversion tracking and analytics

**🎯 CURRENT FOCUS**: Enhance existing working app without breaking functionality

### Current Directory Structure

```
src/
├── index.js           # Main application file (single-file Express server)
├── database.js        # MongoDB connection with Mongoose
├── draft-orders.js    # EXISTS: Draft order functionality (needs enhancement)
├── auth/             # Authentication modules (if exists)
├── middleware/       # Express middleware (if exists)
├── models/           # Database models (if exists)
├── routes/           # API route handlers (if exists)
├── services/         # Business logic services (if exists)
├── utils/            # Utility functions (if exists)
└── public/           # Static assets and HTML pages
    ├── index.html         # Main frontend (working)
    ├── create-price-list.html # Price list creation page
    ├── app.js            # Main frontend JavaScript (working)
    ├── style.css         # Existing styles
    └── js/               # Additional frontend JavaScript (if exists)

config/
├── database.js       # Database configuration (if exists)
└── shopify.js        # Shopify API configuration (if exists)

# PLANNED ADDITIONS (Safe implementation - new files only)
src/public/
├── enhanced-pdf.js      # NEW: Enhanced PDF generation
└── company-config.js    # NEW: Company configuration UI
```

**Implementation Note**: We will add NEW files without modifying existing working code initially, then gradually integrate enhancements.

### Environment Variables Required

**Currently Required (Working Setup)**
```
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_ACCESS_TOKEN=your_access_token
SHOPIFY_SHOP_NAME=your-shop-name
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_session_secret
NODE_ENV=production
PORT=3000
APP_URL=https://your-app.onrender.com
```

**Additional for Enhanced Features**
```
# For Draft Orders integration (when implemented)
# Requires scopes: read_products,write_products,read_orders,write_orders
```

### Development Notes

**Current Architecture**
- **ES Modules**: Uses `"type": "module"` in package.json
- **Single Server File**: Main logic in `src/index.js` with embedded ShopifyService class
- **Working OAuth**: Express + @shopify/shopify-api (proven deployment on Render)
- **Mock Data**: Falls back to sample products when Shopify not configured
- **Static Serving**: HTML/CSS/JS served from `src/public/`
- **Tailwind CSS**: Served from CDN (no build step required)

**PDF Generation Details**
- **Library**: jsPDF for client-side PDF generation
- **Current Fields**: Product name, model, capacity, voltage, dimensions, price, vendor, stock
- **Enhancement Goal**: Remove vendor/stock, add clickable links, improve aesthetics

**Pricing Logic**
- **Base Price**: From Shopify product data
- **Tier Discounts**: Applied as percentage reduction
- **Custom Overrides**: Individual product price changes
- **Visual Indicators**: Shows when custom pricing applied

**Safe Enhancement Strategy**
- **Add New Files**: Don't modify existing working code initially
- **Branch Development**: Use feature branches for testing
- **Gradual Integration**: Enhance incrementally without breaking functionality
- **Rollback Capability**: Can revert to working state if needed

### Testing Shopify Connection

Use the `/api/shopify/debug` endpoint to test and troubleshoot Shopify connectivity. The application will fall back to mock data if Shopify is not configured.

### Current API Endpoints

**Working Endpoints** ✅
- `/api/shopify/debug` - Test Shopify connectivity and troubleshoot
- `/api/shopify/products` - Fetch products with pagination and search
- `/api/shopify/shop` - Get shop information
- Basic product filtering and pricing calculation endpoints

**Planned API Endpoints** 📋
- `POST /api/generate-qr` - Generate QR codes for checkout URLs
- `POST /api/draft-orders/create-draft-order` - Create Shopify draft order from price list
- `POST /api/draft-orders/create-cart-permalink` - Generate cart URLs with custom pricing
- `GET /api/draft-orders/check-conversion/:id` - Track order conversion rates
- `GET /api/health-check` - Verify required dependencies

### Current Dependencies

**Working (package.json)**
```json
{
  "type": "module",
  "dependencies": {
    "express": "^4.18.x",
    "mongoose": "^7.x.x", 
    "dotenv": "^16.x.x",
    "@shopify/shopify-api": "^latest"
  }
}
```

**Planned Additions**
```json
{
  "qrcode": "^1.5.3"
}
```

### Common Development Tasks

**Enhance PDF Features**:
- Modify `enhanced-pdf.js` (new file) for layout changes
- Update PDF generation integration in existing `src/index.js`
- Test PDF output matches design requirements

**Add Company Configuration**:
- Implement `company-config.js` (new file) for UI components  
- Add configuration modal to existing HTML pages
- Integrate with existing pricing logic

**Implement QR Features**:
- Create QR generation endpoints in `src/index.js`
- Enhance `draft-orders.js` for Shopify Draft Orders integration
- Add QR code display to PDF generation

**Database Changes**:
- Update models in `src/models/` (if they exist)
- Modify connection logic in `src/database.js` if needed
- Consider price list history storage

### Safe Implementation Strategy

**Phase-by-Phase Approach**
1. **Create New Files**: Add functionality without modifying working code
2. **Test Locally**: Verify each enhancement works independently  
3. **Gradual Integration**: Slowly incorporate new features into existing workflow
4. **Branch Protection**: Use feature branches, merge only when tested
5. **Rollback Ready**: Can revert to current working state if needed

**Key Files to Preserve**
- `src/index.js` - Main server (enhance gradually)
- `src/public/index.html` - Working frontend (add new features)
- `src/public/app.js` - Existing JavaScript (extend, don't replace)
- Environment variables and deployment configuration

This ensures the currently working price list generator remains functional while we add enhanced features.

### Business Context & Vision

**Current Product**: Universal price list generator for Shopify merchants
**Target Users**: B2B/wholesale businesses, installers, distributors
**Key Innovation**: PDF-to-order conversion via QR codes (planned - would be first of its kind)

**Market Opportunity**
- Large Shopify ecosystem with wholesale/B2B segment
- Current competitors offer basic price list generation only
- Our planned QR checkout feature would be unique differentiator

**Development Priorities**
1. **Complete Enhanced PDF** - Professional aesthetics, company/client separation
2. **QR Integration** - Draft Orders API and checkout workflows  
3. **Polish & Testing** - Ensure reliability before broader release
4. **Shopify App Store** - Prepare for public distribution when ready

### Next Immediate Tasks

**Phase 1: Enhanced PDF (Current Focus)**
- Implement professional PDF design matching provided example
- Add company vs client configuration system
- Remove vendor/stock fields from PDFs
- Make product links clickable

**Phase 2: QR Integration** 
- Implement Draft Orders API endpoints
- Add QR code generation capability
- Create checkout workflow integration
- Test end-to-end PDF → QR → Order flow

**Phase 3: Polish & Deploy**
- Comprehensive testing of all features
- Performance optimization
- Documentation and user guides
- Prepare for wider distribution