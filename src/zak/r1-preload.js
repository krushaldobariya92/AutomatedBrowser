const { contextBridge, ipcRenderer } = require('electron');

// Expose R1 functionality to renderer process
contextBridge.exposeInMainWorld('r1', {
    // Form Analysis
    analyzeForm: async (pageContent, url) => {
        return await ipcRenderer.invoke('r1:analyzeForm', { pageContent, url });
    },

    // Form Field Mapping
    mapFormFields: async (sourceForm, targetForm) => {
        return await ipcRenderer.invoke('r1:mapFormFields', { sourceForm, targetForm });
    },

    // Form Automation Planning
    planAutomation: async (form, data) => {
        return await ipcRenderer.invoke('r1:planAutomation', { form, data });
    },

    // Workflow Optimization
    optimizeWorkflow: async (workflow) => {
        return await ipcRenderer.invoke('r1:optimizeWorkflow', { workflow });
    }
}); 