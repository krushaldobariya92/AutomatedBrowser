const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    ipcRenderer: {
      invoke: (channel, ...args) => {
        return ipcRenderer.invoke(channel, ...args);
      },
      send: (channel, ...args) => {
        ipcRenderer.send(channel, ...args);
      },
      on: (channel, func) => {
        // Strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      },
      once: (channel, func) => {
        ipcRenderer.once(channel, (event, ...args) => func(...args));
      },
      removeListener: (channel, func) => {
        ipcRenderer.removeListener(channel, func);
      }
    }
  }
);

// Expose Gemma functionality to the renderer process
contextBridge.exposeInMainWorld('gemma', {
  // Form Analysis
  analyzeForm: async (pageContent, url) => {
    return await ipcRenderer.invoke('gemma:analyze-form', { pageContent, url });
  },
  
  // Form Field Mapping
  mapFormFields: async (sourceForm, targetForm) => {
    return await ipcRenderer.invoke('gemma:map-fields', { sourceForm, targetForm });
  },
  
  // Form Automation Planning
  planAutomation: async (form, testData) => {
    return await ipcRenderer.invoke('gemma:plan-automation', { form, testData });
  },
  
  // Workflow Optimization
  optimizeWorkflow: async (workflow) => {
    return await ipcRenderer.invoke('gemma:optimize-workflow', { workflow });
  }
});

console.log('Main window preload script loaded'); 