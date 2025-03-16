/**
 * Form Templates Module
 * Handles the management of form templates for automated form filling
 */

const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

// Model: Handles data storage and retrieval
class FormTemplateModel {
  constructor(dataDir) {
    this.templatesFile = path.join(dataDir, 'form-templates.json');
    this.templates = {};
    this.loadTemplates();
  }

  loadTemplates() {
    try {
      if (fs.existsSync(this.templatesFile)) {
        this.templates = JSON.parse(fs.readFileSync(this.templatesFile, 'utf8'));
        console.log('Loaded form templates:', Object.keys(this.templates).length);
      } else {
        console.log('No form templates file found, creating empty templates');
        this.templates = {};
      }
    } catch (error) {
      console.error('Error loading form templates:', error);
      this.templates = {};
    }
  }

  saveTemplates() {
    try {
      fs.writeFileSync(this.templatesFile, JSON.stringify(this.templates, null, 2), 'utf8');
      console.log('Saved form templates');
      return true;
    } catch (error) {
      console.error('Error saving form templates:', error);
      return false;
    }
  }

  getTemplates() {
    return this.templates;
  }

  getTemplate(name) {
    return this.templates[name];
  }

  saveTemplate(name, fields) {
    this.templates[name] = {
      name,
      fields,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    return this.saveTemplates();
  }

  updateTemplate(name, fields) {
    if (!this.templates[name]) {
      return false;
    }
    
    this.templates[name].fields = fields;
    this.templates[name].updatedAt = Date.now();
    return this.saveTemplates();
  }

  deleteTemplate(name) {
    if (!this.templates[name]) {
      return false;
    }
    
    delete this.templates[name];
    return this.saveTemplates();
  }
}

// Controller: Handles business logic and coordinates between model and presenter
class FormTemplateController {
  constructor(dataDir) {
    this.model = new FormTemplateModel(dataDir);
    this.setupIpcHandlers();
  }

  setupIpcHandlers() {
    // Get all templates - support both new and legacy channel names
    ipcMain.handle('formTemplate:getAll', async () => {
      console.log('IPC: Get all form templates');
      try {
        return this.model.getTemplates();
      } catch (error) {
        console.error('Error in formTemplate:getAll handler:', error);
        return { error: error.message || 'Unknown error loading templates' };
      }
    });
    
    // Legacy handler for backward compatibility
    ipcMain.handle('formTemplates:get', async () => {
      console.log('Legacy IPC: Get all form templates');
      try {
        return this.model.getTemplates();
      } catch (error) {
        console.error('Error in formTemplates:get handler:', error);
        return { error: error.message || 'Unknown error loading templates' };
      }
    });

    // Get a specific template
    ipcMain.handle('formTemplate:get', async (event, name) => {
      console.log('IPC: Get form template', name);
      try {
        const template = this.model.getTemplate(name);
        
        if (!template) {
          return { success: false, message: `Template not found: ${name}` };
        }
        
        return { success: true, template };
      } catch (error) {
        console.error(`Error getting template ${name}:`, error);
        return { success: false, message: error.message || 'Unknown error' };
      }
    });

    // Save a new template
    ipcMain.handle('formTemplate:save', async (event, name, fields) => {
      console.log('IPC: Save form template', name, fields);
      try {
        const success = this.model.saveTemplate(name, fields);
        return { success };
      } catch (error) {
        console.error(`Error saving template ${name}:`, error);
        return { success: false, message: error.message || 'Unknown error' };
      }
    });

    // Update an existing template
    ipcMain.handle('formTemplate:update', async (event, name, fields) => {
      console.log('IPC: Update form template', name);
      try {
        const success = this.model.updateTemplate(name, fields);
        return { success };
      } catch (error) {
        console.error(`Error updating template ${name}:`, error);
        return { success: false, message: error.message || 'Unknown error' };
      }
    });

    // Delete a template
    ipcMain.handle('formTemplate:delete', async (event, name) => {
      console.log('IPC: Delete form template', name);
      try {
        const success = this.model.deleteTemplate(name);
        return { success };
      } catch (error) {
        console.error(`Error deleting template ${name}:`, error);
        return { success: false, message: error.message || 'Unknown error' };
      }
    });

    // Apply a template to a form
    ipcMain.handle('formTemplate:apply', (event, { name, url }) => {
      console.log('IPC: Apply form template', name, 'to URL:', url);
      
      const template = this.model.getTemplate(name);
      
      if (!template) {
        return { success: false, message: `Template not found: ${name}` };
      }
      
      return { 
        success: true, 
        template,
        message: `Template ready to apply: ${name}`
      };
    });
  }
}

// Export the module
module.exports = {
  initialize: (dataDir) => {
    console.log('Initializing form templates module');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      console.log('Creating data directory');
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create controller instance
    const controller = new FormTemplateController(dataDir);
    
    return controller;
  }
}; 