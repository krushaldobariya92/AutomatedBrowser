/**
 * Form Templates UI Module (Presenter)
 * Handles the UI for form templates management
 */

const { ipcRenderer } = window.electron;

// Form Templates Presenter
class FormTemplatesPresenter {
  constructor() {
    this.templates = {};
    this.selectedTemplate = null;
    this.templatePanelElement = null;
    this.templateListElement = null;
    this.templateNameInput = null;
    this.templateFieldsContainer = null;
    this.saveTemplateButton = null;
    this.deleteTemplateButton = null;
    this.applyTemplateButton = null;
    this.statusElement = null;
    
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    console.log('Initializing form templates UI');
    
    // Create UI elements
    this.createTemplatePanel();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load templates
    await this.loadTemplates();
    
    this.initialized = true;
  }
  
  createTemplatePanel() {
    console.log('Creating form templates panel');
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'template-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 999; display: none;';
    overlay.addEventListener('click', () => this.hideTemplatePanel());
    
    // Create panel
    const panel = document.createElement('div');
    panel.id = 'template-panel';
    panel.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); z-index: 1000; display: none; width: 600px; max-height: 80vh; overflow-y: auto;';
    panel.addEventListener('click', e => e.stopPropagation());
    
    // Create content
    panel.innerHTML = `
      <h2 style="margin: 0 0 20px 0; color: #1E3A8A;">Form Templates Manager</h2>
      
      <div class="template-controls" style="margin-bottom: 20px;">
        <input type="text" id="template-name" placeholder="Template name" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-right: 10px; width: 200px;">
        <button id="create-template" style="background: #1E3A8A; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer;">Create New</button>
        <button id="capture-form" style="background: #6366F1; color: white; border: none; border-radius: 4px; padding: 8px 12px; margin-left: 5px; cursor: pointer;">Capture Form</button>
      </div>
      
      <div class="template-list-container" style="display: flex; gap: 20px; margin-bottom: 20px;">
        <div class="template-list" style="flex: 1; border: 1px solid #ddd; border-radius: 4px; max-height: 300px; overflow-y: auto;">
          <!-- Templates will be listed here -->
        </div>
        
        <div class="template-details" style="flex: 2; border: 1px solid #ddd; border-radius: 4px; padding: 15px;">
          <h3 style="margin: 0 0 15px 0; color: #1E3A8A;">Template Fields</h3>
          
          <div id="template-fields-container" style="margin-bottom: 15px;">
            <!-- Template fields will be added here -->
            <div class="template-empty" style="text-align: center; color: #6B7280; font-size: 14px; padding: 20px 0;">
              Select a template or create a new one
            </div>
          </div>
          
          <button id="add-field" style="background: #10B981; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer; display: none;">Add Field</button>
        </div>
      </div>
      
      <div class="template-actions" style="display: flex; gap: 10px; margin-bottom: 20px;">
        <button id="save-template" style="background: #059669; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: not-allowed; opacity: 0.5;" disabled>Save</button>
        <button id="delete-template" style="background: #DC2626; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: not-allowed; opacity: 0.5;" disabled>Delete</button>
        <button id="apply-template" style="background: #3B82F6; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: not-allowed; opacity: 0.5;" disabled>Apply to Form</button>
      </div>
      
      <div id="template-status" style="color: #6B7280; font-size: 14px;"></div>
    `;
    
    // Add to document
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    
    // Store references to UI elements
    this.templatePanelElement = panel;
    this.templateListElement = panel.querySelector('.template-list');
    this.templateNameInput = panel.querySelector('#template-name');
    this.templateFieldsContainer = panel.querySelector('#template-fields-container');
    this.saveTemplateButton = panel.querySelector('#save-template');
    this.deleteTemplateButton = panel.querySelector('#delete-template');
    this.applyTemplateButton = panel.querySelector('#apply-template');
    this.statusElement = panel.querySelector('#template-status');
    this.addFieldButton = panel.querySelector('#add-field');
    
    // Add menu item to show template panel
    this.addTemplateMenuItem();
  }
  
  addTemplateMenuItem() {
    // Add to browser menu if it exists
    const menuContainer = document.querySelector('.browser-menu');
    if (menuContainer) {
      const menuItem = document.createElement('div');
      menuItem.className = 'menu-item';
      menuItem.textContent = 'Form Templates';
      menuItem.addEventListener('click', () => this.showTemplatePanel());
      menuContainer.appendChild(menuItem);
    }
  }
  
  setupEventListeners() {
    // Create new template
    this.templatePanelElement.querySelector('#create-template').addEventListener('click', () => {
      this.createNewTemplate();
    });
    
    // Capture form
    this.templatePanelElement.querySelector('#capture-form').addEventListener('click', () => {
      this.captureForm();
    });
    
    // Add field
    this.addFieldButton.addEventListener('click', () => {
      this.addField();
    });
    
    // Save template
    this.saveTemplateButton.addEventListener('click', async () => {
      await this.saveTemplate();
    });
    
    // Delete template
    this.deleteTemplateButton.addEventListener('click', async () => {
      await this.deleteTemplate();
    });
    
    // Apply template
    this.applyTemplateButton.addEventListener('click', async () => {
      await this.applyTemplate();
    });
  }
  
  async loadTemplates() {
    console.log('Loading form templates');
    
    try {
      this.templates = await ipcRenderer.invoke('formTemplate:getAll');
      console.log('Loaded templates:', Object.keys(this.templates).length);
      
      // Clear template list
      this.templateListElement.innerHTML = '';
      
      if (Object.keys(this.templates).length === 0) {
        this.templateListElement.innerHTML = '<div class="template-empty" style="text-align: center; color: #6B7280; font-size: 14px; padding: 20px 0;">No templates yet. Create one to get started!</div>';
        return;
      }
      
      // Add template items
      for (const [name, template] of Object.entries(this.templates)) {
        const item = document.createElement('div');
        item.className = 'template-item';
        item.dataset.name = name;
        item.style.cssText = 'padding: 10px; border-bottom: 1px solid #ddd; cursor: pointer;';
        
        const createdDate = new Date(template.createdAt).toLocaleDateString();
        const fieldCount = template.fields.length;
        
        item.innerHTML = `
          <div class="template-item-header" style="font-weight: 500;">${name}</div>
          <div class="template-item-details" style="font-size: 12px; color: #6B7280; margin-top: 4px;">
            ${fieldCount} fields | Created: ${createdDate}
          </div>
        `;
        
        item.addEventListener('click', () => {
          this.selectTemplate(name);
        });
        
        this.templateListElement.appendChild(item);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      this.updateStatus('Error loading templates');
    }
  }
  
  selectTemplate(name) {
    console.log('Selecting template:', name);
    
    // Deselect all items
    document.querySelectorAll('.template-item').forEach(el => {
      el.classList.remove('selected');
      el.style.background = 'none';
    });
    
    // Select this item
    const item = document.querySelector(`.template-item[data-name="${name}"]`);
    if (item) {
      item.classList.add('selected');
      item.style.background = 'rgba(59, 130, 246, 0.1)';
    }
    
    // Get template
    this.selectedTemplate = this.templates[name];
    
    // Update name input
    this.templateNameInput.value = name;
    
    // Display fields
    this.displayTemplateFields();
    
    // Enable buttons
    this.saveTemplateButton.disabled = false;
    this.saveTemplateButton.style.opacity = '1';
    this.saveTemplateButton.style.cursor = 'pointer';
    
    this.deleteTemplateButton.disabled = false;
    this.deleteTemplateButton.style.opacity = '1';
    this.deleteTemplateButton.style.cursor = 'pointer';
    
    this.applyTemplateButton.disabled = false;
    this.applyTemplateButton.style.opacity = '1';
    this.applyTemplateButton.style.cursor = 'pointer';
    
    // Show add field button
    this.addFieldButton.style.display = 'block';
  }
  
  displayTemplateFields() {
    if (!this.selectedTemplate) {
      this.templateFieldsContainer.innerHTML = '<div class="template-empty" style="text-align: center; color: #6B7280; font-size: 14px; padding: 20px 0;">Select a template or create a new one</div>';
      return;
    }
    
    this.templateFieldsContainer.innerHTML = '';
    
    // Add fields
    this.selectedTemplate.fields.forEach((field, index) => {
      this.addFieldToUI(field, index);
    });
  }
  
  addFieldToUI(field = { selector: '', name: '', value: '' }, index) {
    const fieldElement = document.createElement('div');
    fieldElement.className = 'template-field';
    fieldElement.dataset.index = index;
    fieldElement.style.cssText = 'margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;';
    
    fieldElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <h4 style="margin: 0; font-size: 14px;">Field #${index + 1}</h4>
        <button class="remove-field" style="background: none; border: none; color: #DC2626; cursor: pointer;">Remove</button>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px;">Field Name</label>
        <input type="text" class="field-name" value="${field.name || ''}" placeholder="e.g. username" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px;">CSS Selector</label>
        <input type="text" class="field-selector" value="${field.selector || ''}" placeholder="e.g. #username" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div>
        <label style="display: block; margin-bottom: 5px;">Default Value</label>
        <input type="text" class="field-value" value="${field.value || ''}" placeholder="e.g. john.doe" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
    `;
    
    // Add remove field handler
    fieldElement.querySelector('.remove-field').addEventListener('click', () => {
      fieldElement.remove();
      this.updateFieldIndices();
    });
    
    this.templateFieldsContainer.appendChild(fieldElement);
  }
  
  updateFieldIndices() {
    // Update field indices after removal
    document.querySelectorAll('.template-field').forEach((field, index) => {
      field.dataset.index = index;
      field.querySelector('h4').textContent = `Field #${index + 1}`;
    });
  }
  
  createNewTemplate() {
    // Clear selection
    document.querySelectorAll('.template-item').forEach(el => {
      el.classList.remove('selected');
      el.style.background = 'none';
    });
    
    // Reset form
    this.selectedTemplate = null;
    this.templateNameInput.value = '';
    this.templateFieldsContainer.innerHTML = '';
    
    // Add empty field
    this.addField();
    
    // Enable save button
    this.saveTemplateButton.disabled = false;
    this.saveTemplateButton.style.opacity = '1';
    this.saveTemplateButton.style.cursor = 'pointer';
    
    // Disable other buttons
    this.deleteTemplateButton.disabled = true;
    this.deleteTemplateButton.style.opacity = '0.5';
    this.deleteTemplateButton.style.cursor = 'not-allowed';
    
    this.applyTemplateButton.disabled = true;
    this.applyTemplateButton.style.opacity = '0.5';
    this.applyTemplateButton.style.cursor = 'not-allowed';
    
    // Show add field button
    this.addFieldButton.style.display = 'block';
  }
  
  addField() {
    const fieldCount = document.querySelectorAll('.template-field').length;
    this.addFieldToUI({ selector: '', name: '', value: '' }, fieldCount);
  }
  
  async saveTemplate() {
    const name = this.templateNameInput.value.trim();
    
    if (!name) {
      this.updateStatus('Template name is required');
      return;
    }
    
    // Collect fields
    const fields = [];
    document.querySelectorAll('.template-field').forEach(fieldElement => {
      const nameInput = fieldElement.querySelector('.field-name');
      const selectorInput = fieldElement.querySelector('.field-selector');
      const valueInput = fieldElement.querySelector('.field-value');
      
      fields.push({
        name: nameInput.value.trim(),
        selector: selectorInput.value.trim(),
        value: valueInput.value
      });
    });
    
    if (fields.length === 0) {
      this.updateStatus('Template must have at least one field');
      return;
    }
    
    try {
      let result;
      
      if (this.selectedTemplate && this.templates[name]) {
        // Update existing template
        result = await ipcRenderer.invoke('formTemplate:update', { name, fields });
      } else {
        // Create new template
        result = await ipcRenderer.invoke('formTemplate:save', { name, fields });
      }
      
      if (result.success) {
        this.updateStatus(result.message);
        await this.loadTemplates();
        this.selectTemplate(name);
      } else {
        this.updateStatus(result.message);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      this.updateStatus('Error saving template');
    }
  }
  
  async deleteTemplate() {
    if (!this.selectedTemplate) {
      return;
    }
    
    const name = this.templateNameInput.value.trim();
    
    if (confirm(`Are you sure you want to delete the template "${name}"?`)) {
      try {
        const result = await ipcRenderer.invoke('formTemplate:delete', name);
        
        if (result.success) {
          this.updateStatus(result.message);
          await this.loadTemplates();
          
          // Reset selection
          this.selectedTemplate = null;
          this.templateNameInput.value = '';
          this.templateFieldsContainer.innerHTML = '<div class="template-empty" style="text-align: center; color: #6B7280; font-size: 14px; padding: 20px 0;">Select a template or create a new one</div>';
          
          // Disable buttons
          this.saveTemplateButton.disabled = true;
          this.saveTemplateButton.style.opacity = '0.5';
          this.saveTemplateButton.style.cursor = 'not-allowed';
          
          this.deleteTemplateButton.disabled = true;
          this.deleteTemplateButton.style.opacity = '0.5';
          this.deleteTemplateButton.style.cursor = 'not-allowed';
          
          this.applyTemplateButton.disabled = true;
          this.applyTemplateButton.style.opacity = '0.5';
          this.applyTemplateButton.style.cursor = 'not-allowed';
          
          // Hide add field button
          this.addFieldButton.style.display = 'none';
        } else {
          this.updateStatus(result.message);
        }
      } catch (error) {
        console.error('Error deleting template:', error);
        this.updateStatus('Error deleting template');
      }
    }
  }
  
  async applyTemplate() {
    if (!this.selectedTemplate) {
      return;
    }
    
    const name = this.templateNameInput.value.trim();
    const currentUrl = await getCurrentUrl();
    
    try {
      const result = await ipcRenderer.invoke('formTemplate:apply', { name, url: currentUrl });
      
      if (result.success) {
        this.updateStatus(result.message);
        
        // Apply template to current page
        const template = result.template;
        
        // Send to active webview
        const webview = document.querySelector('webview.active');
        if (webview) {
          webview.send('apply-form-template', template);
          this.updateStatus(`Applied template "${name}" to current page`);
        } else {
          this.updateStatus('No active webview found');
        }
      } else {
        this.updateStatus(result.message);
      }
    } catch (error) {
      console.error('Error applying template:', error);
      this.updateStatus('Error applying template');
    }
  }
  
  async captureForm() {
    // Get the active webview
    const webview = document.querySelector('webview.active');
    if (!webview) {
      this.updateStatus('No active webview found');
      return;
    }
    
    // Request form capture from webview
    webview.send('capture-form');
    
    // Listen for response
    webview.addEventListener('ipc-message', async (event) => {
      if (event.channel === 'form-captured') {
        const formData = event.args[0];
        console.log('Form captured:', formData);
        
        if (!formData || !formData.fields || formData.fields.length === 0) {
          this.updateStatus('No form fields found on the page');
          return;
        }
        
        // Create new template with captured fields
        this.createNewTemplate();
        
        // Set template name based on page title
        const pageTitle = await getPageTitle();
        this.templateNameInput.value = `Form - ${pageTitle}`;
        
        // Clear existing fields
        this.templateFieldsContainer.innerHTML = '';
        
        // Add captured fields
        formData.fields.forEach((field, index) => {
          this.addFieldToUI({
            name: field.name || `field_${index + 1}`,
            selector: field.selector,
            value: field.value || ''
          }, index);
        });
        
        this.updateStatus('Form captured successfully');
      }
    }, { once: true });
  }
  
  showTemplatePanel() {
    document.getElementById('template-overlay').style.display = 'block';
    this.templatePanelElement.style.display = 'block';
  }
  
  hideTemplatePanel() {
    document.getElementById('template-overlay').style.display = 'none';
    this.templatePanelElement.style.display = 'none';
  }
  
  updateStatus(message) {
    this.statusElement.textContent = message;
    console.log('Template status:', message);
    
    // Clear status after 3 seconds
    setTimeout(() => {
      if (this.statusElement.textContent === message) {
        this.statusElement.textContent = '';
      }
    }, 3000);
  }
}

// Helper function to get current URL from active webview
async function getCurrentUrl() {
  const webview = document.querySelector('webview.active');
  if (!webview) {
    return '';
  }
  
  try {
    return await webview.executeJavaScript('window.location.href');
  } catch (error) {
    console.error('Error getting current URL:', error);
    return '';
  }
}

// Helper function to get page title from active webview
async function getPageTitle() {
  const webview = document.querySelector('webview.active');
  if (!webview) {
    return '';
  }
  
  try {
    return await webview.executeJavaScript('document.title');
  } catch (error) {
    console.error('Error getting page title:', error);
    return '';
  }
}

// Create and export singleton instance
const formTemplatesPresenter = new FormTemplatesPresenter();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  formTemplatesPresenter.initialize();
});

// Export the module
module.exports = formTemplatesPresenter; 