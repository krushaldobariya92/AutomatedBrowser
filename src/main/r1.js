const { ipcMain } = require('electron');
const { R1Integration } = require('./r1-integration');

class R1Manager {
    constructor() {
        this.r1 = new R1Integration();
        this.setupIPCHandlers();
    }

    async initialize() {
        try {
            await this.r1.initialize();
            console.log('R1 initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize R1:', error);
            return false;
        }
    }

    setupIPCHandlers() {
        // Form Analysis
        ipcMain.handle('r1:analyze-form', async (event, { pageContent, url }) => {
            try {
                return await this.r1.analyzeForm(pageContent, url);
            } catch (error) {
                console.error('Error in r1:analyze-form handler:', error);
                throw error;
            }
        });

        // Field Mapping
        ipcMain.handle('r1:map-fields', async (event, { sourceForm, targetForm }) => {
            try {
                return await this.r1.mapFormFields(sourceForm, targetForm);
            } catch (error) {
                console.error('Error in r1:map-fields handler:', error);
                throw error;
            }
        });

        // Automation Planning
        ipcMain.handle('r1:plan-automation', async (event, { form, testData }) => {
            try {
                return await this.r1.planAutomation(form, testData);
            } catch (error) {
                console.error('Error in r1:plan-automation handler:', error);
                throw error;
            }
        });

        // Workflow Optimization
        ipcMain.handle('r1:optimize-workflow', async (event, { workflow }) => {
            try {
                return await this.r1.optimizeWorkflow(workflow);
            } catch (error) {
                console.error('Error in r1:optimize-workflow handler:', error);
                throw error;
            }
        });
    }
}

module.exports = { R1Manager }; 