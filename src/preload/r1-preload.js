const { contextBridge, ipcRenderer } = require('electron');

// Expose R1 functionality to renderer process
contextBridge.exposeInMainWorld('r1', {
    // Form Analysis
    analyzeForm: async (pageContent, url) => {
        try {
            const result = await ipcRenderer.invoke('r1:analyze-form', { pageContent, url });
            if (!result.success) {
                throw new Error(result.message || 'Form analysis failed');
            }
            return result;
        } catch (error) {
            console.error('Error in analyzeForm:', error);
            throw error;
        }
    },

    // Field Mapping
    mapFormFields: async (sourceForm, targetForm) => {
        try {
            const result = await ipcRenderer.invoke('r1:map-fields', { sourceForm, targetForm });
            if (!result.success) {
                throw new Error(result.message || 'Field mapping failed');
            }
            return result;
        } catch (error) {
            console.error('Error in mapFormFields:', error);
            throw error;
        }
    },

    // Automation Planning
    planAutomation: async (form, testData) => {
        try {
            const result = await ipcRenderer.invoke('r1:plan-automation', { form, testData });
            if (!result.success) {
                throw new Error(result.message || 'Automation planning failed');
            }
            return result;
        } catch (error) {
            console.error('Error in planAutomation:', error);
            throw error;
        }
    },

    // Workflow Optimization
    optimizeWorkflow: async (workflow) => {
        try {
            const result = await ipcRenderer.invoke('r1:optimize-workflow', { workflow });
            if (!result.success) {
                throw new Error(result.message || 'Workflow optimization failed');
            }
            return result;
        } catch (error) {
            console.error('Error in optimizeWorkflow:', error);
            throw error;
        }
    }
}); 