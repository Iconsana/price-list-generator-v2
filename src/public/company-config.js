// Company Configuration Manager - Add to src/public/company-config.js
// This handles the company vs client distinction

class CompanyConfigManager {
    constructor() {
        this.storageKey = 'priceListCompanyConfig';
        this.loadConfiguration();
    }

    // Load saved configuration or set defaults
    loadConfiguration() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            this.config = JSON.parse(saved);
        } else {
            this.config = this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            yourCompany: {
                name: "Your Company Name",
                tagline: "Professional • Reliable • Quality",
                email: "sales@yourcompany.com",
                phone: "+1 234 567-8900",
                website: "https://yourcompany.com",
                address: "123 Business Street, City, Country",
                logo: null
            },
            defaultSettings: {
                showClientDetails: true,
                showPricingTier: true,
                listTitle: "Professional Price List"
            }
        };
    }

    // Save configuration
    saveConfiguration() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.config));
        this.showNotification('Configuration saved successfully!', 'success');
    }

    // Update your company details
    updateYourCompany(field, value) {
        this.config.yourCompany[field] = value;
        this.saveConfiguration();
    }

    // Get current client configuration
    getCurrentClientConfig() {
        return {
            name: document.getElementById('clientName')?.value || 'Client Company',
            category: document.getElementById('pricingCategory')?.value || 'wholesale',
            contactPerson: document.getElementById('clientContact')?.value || '',
            email: document.getElementById('clientEmail')?.value || '',
            notes: document.getElementById('clientNotes')?.value || ''
        };
    }

    // Create configuration UI
    createConfigurationUI() {
        const configHTML = `
            <div id="companyConfigModal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Company Configuration</h2>
                        <span class="close" onclick="companyConfig.closeModal()">&times;</span>
                    </div>
                    
                    <div class="config-tabs">
                        <button class="tab-button active" onclick="companyConfig.showTab('your-company')">Your Company</button>
                        <button class="tab-button" onclick="companyConfig.showTab('client-setup')">Current Client</button>
                        <button class="tab-button" onclick="companyConfig.showTab('preview')">Preview</button>
                    </div>

                    <!-- Your Company Tab -->
                    <div id="your-company-tab" class="tab-content active">
                        <h3>Your Company Details <small>(Consistent across all price lists)</small></h3>
                        
                        <div class="form-group">
                            <label>Company Name:</label>
                            <input type="text" id="yourCompanyName" value="${this.config.yourCompany.name}" 
                                   onchange="companyConfig.updateYourCompany('name', this.value)">
                        </div>
                        
                        <div class="form-group">
                            <label>Tagline:</label>
                            <input type="text" id="yourCompanyTagline" value="${this.config.yourCompany.tagline}"
                                   onchange="companyConfig.updateYourCompany('tagline', this.value)">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Email:</label>
                                <input type="email" id="yourCompanyEmail" value="${this.config.yourCompany.email}"
                                       onchange="companyConfig.updateYourCompany('email', this.value)">
                            </div>
                            <div class="form-group">
                                <label>Phone:</label>
                                <input type="tel" id="yourCompanyPhone" value="${this.config.yourCompany.phone}"
                                       onchange="companyConfig.updateYourCompany('phone', this.value)">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Website:</label>
                            <input type="url" id="yourCompanyWebsite" value="${this.config.yourCompany.website}"
                                   onchange="companyConfig.updateYourCompany('website', this.value)">
                        </div>
                        
                        <div class="form-group">
                            <label>Logo Upload:</label>
                            <input type="file" id="logoUpload" accept="image/*" onchange="companyConfig.handleLogoUpload(this)">
                            ${this.config.yourCompany.logo ? '<div class="logo-preview"><img src="' + this.config.yourCompany.logo + '" alt="Logo"></div>' : ''}
                        </div>
                    </div>

                    <!-- Client Setup Tab -->
                    <div id="client-setup-tab" class="tab-content">
                        <h3>Current Client Details <small>(Changes per price list)</small></h3>
                        
                        <div class="form-group">
                            <label>Client Company Name:</label>
                            <input type="text" id="clientName" placeholder="Client Company Name">
                        </div>
                        
                        <div class="form-group">
                            <label>Pricing Category:</label>
                            <select id="pricingCategory" onchange="companyConfig.updatePricingPreview()">
                                <option value="wholesale">Wholesale (15% discount)</option>
                                <option value="installer">Installer (20% discount)</option>
                                <option value="distributor">Distributor (25% discount)</option>
                                <option value="retail">Retail (0% discount)</option>
                            </select>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Contact Person:</label>
                                <input type="text" id="clientContact" placeholder="John Smith">
                            </div>
                            <div class="form-group">
                                <label>Email:</label>
                                <input type="email" id="clientEmail" placeholder="orders@client.com">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Notes:</label>
                            <textarea id="clientNotes" placeholder="Special pricing notes, delivery instructions, etc."></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="showClientDetails" checked> 
                                Show client details on price list
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="showPricingTier" checked> 
                                Show pricing tier badge
                            </label>
                        </div>
                    </div>

                    <!-- Preview Tab -->
                    <div id="preview-tab" class="tab-content">
                        <h3>Price List Header Preview</h3>
                        <div id="headerPreview" class="header-preview">
                            <!-- Preview will be generated here -->
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button onclick="companyConfig.applyConfiguration()" class="btn-primary">Apply Configuration</button>
                        <button onclick="companyConfig.closeModal()" class="btn-secondary">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Add to page if not exists
        if (!document.getElementById('companyConfigModal')) {
            document.body.insertAdjacentHTML('beforeend', configHTML);
            this.addConfigStyles();
        }
    }

    // Add CSS styles
    addConfigStyles() {
        const styles = `
            <style>
                .modal {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5); z-index: 1000;
                    display: flex; align-items: center; justify-content: center;
                }
                .modal-content {
                    background: white; border-radius: 8px; padding: 20px;
                    max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;
                }
                .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .close { font-size: 24px; cursor: pointer; }
                .config-tabs { display: flex; margin-bottom: 20px; border-bottom: 1px solid #ddd; }
                .tab-button { padding: 10px 20px; border: none; background: none; cursor: pointer; }
                .tab-button.active { border-bottom: 2px solid #007cba; color: #007cba; }
                .tab-content { display: none; }
                .tab-content.active { display: block; }
                .form-group { margin-bottom: 15px; }
                .form-row { display: flex; gap: 15px; }
                .form-row .form-group { flex: 1; }
                .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
                .form-group input, .form-group select, .form-group textarea {
                    width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;
                }
                .logo-preview img { max-width: 100px; max-height: 60px; }
                .header-preview {
                    background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                    color: white; padding: 20px; border-radius: 8px;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .modal-footer { margin-top: 20px; text-align: right; }
                .btn-primary, .btn-secondary { padding: 10px 20px; margin-left: 10px; border: none; border-radius: 4px; cursor: pointer; }
                .btn-primary { background: #007cba; color: white; }
                .btn-secondary { background: #ccc; color: black; }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // Show configuration modal
    showModal() {
        this.createConfigurationUI();
        document.getElementById('companyConfigModal').style.display = 'flex';
        this.updatePreview();
    }

    // Close modal
    closeModal() {
        document.getElementById('companyConfigModal').style.display = 'none';
    }

    // Show specific tab
    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        
        // Show selected tab
        document.getElementById(tabName + '-tab').classList.add('active');
        event.target.classList.add('active');
        
        if (tabName === 'preview') {
            this.updatePreview();
        }
    }

    // Handle logo upload
    handleLogoUpload(input) {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.updateYourCompany('logo', e.target.result);
                // Update preview
                const existingPreview = document.querySelector('.logo-preview');
                if (existingPreview) {
                    existingPreview.innerHTML = `<img src="${e.target.result}" alt="Logo">`;
                } else {
                    input.parentNode.insertAdjacentHTML('beforeend', 
                        `<div class="logo-preview"><img src="${e.target.result}" alt="Logo"></div>`);
                }
            };
            reader.readAsDataURL(file);
        }
    }

    // Update preview
    updatePreview() {
        const clientConfig = this.getCurrentClientConfig();
        const showClientDetails = document.getElementById('showClientDetails')?.checked ?? true;
        const showPricingTier = document.getElementById('showPricingTier')?.checked ?? true;
        
        const previewHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 20px; font-weight: bold;">${this.config.yourCompany.name}</div>
                    <div style="font-size: 12px; opacity: 0.9;">${this.config.yourCompany.tagline}</div>
                </div>
                ${showClientDetails ? `
                    <div style="text-align: right;">
                        <div style="font-size: 10px; opacity: 0.8;">PREPARED FOR:</div>
                        <div style="font-size: 16px; font-weight: bold;">${clientConfig.name || 'CLIENT NAME'}</div>
                        ${showPricingTier ? `
                            <div style="margin-top: 8px;">
                                <span style="background: #e74c3c; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">
                                    ${clientConfig.category.toUpperCase()} PRICING
                                </span>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
        
        const previewEl = document.getElementById('headerPreview');
        if (previewEl) {
            previewEl.innerHTML = previewHTML;
        }
    }

    // Apply configuration to main app
    applyConfiguration() {
        const clientConfig = this.getCurrentClientConfig();
        clientConfig.showClientDetails = document.getElementById('showClientDetails')?.checked ?? true;
        clientConfig.showPricingTier = document.getElementById('showPricingTier')?.checked ?? true;
        
        // Trigger event for main app to use new configuration
        const event = new CustomEvent('configurationUpdated', {
            detail: {
                yourCompany: this.config.yourCompany,
                clientConfig: clientConfig
            }
        });
        
        document.dispatchEvent(event);
        this.showNotification('Configuration applied successfully!', 'success');
        this.closeModal();
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 2000;
            padding: 12px 20px; border-radius: 4px; color: white;
            background: ${type === 'success' ? '#27ae60' : '#3498db'};
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize global instance
window.companyConfig = new CompanyConfigManager();
