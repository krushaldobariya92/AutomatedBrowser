// Gemma UI Component
class GemmaUI {
    constructor() {
        this.isInitialized = false;
        this.createPanel();
        this.setupEventListeners();
    }

    // Create Gemma panel
    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'gemma-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80%;
            max-width: 800px;
            height: 80%;
            max-height: 600px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            z-index: 1001;
            display: none;
            padding: 20px;
            overflow: auto;
        `;

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Gemma Assistant</h2>
                <button id="gemma-close-btn" style="background: none; border: none; cursor: pointer;">✕</button>
            </div>
            
            <div class="gemma-tabs" style="margin-bottom: 20px;">
                <button class="gemma-tab active" data-tab="analyze">Analyze Form</button>
                <button class="gemma-tab" data-tab="map">Map Fields</button>
                <button class="gemma-tab" data-tab="automate">Plan Automation</button>
                <button class="gemma-tab" data-tab="optimize">Optimize Workflow</button>
            </div>
            
            <div class="gemma-content">
                <!-- Analyze Form Tab -->
                <div id="gemma-analyze" class="gemma-tab-content active">
                    <p>Analyze the current form to identify fields and their purposes.</p>
                    <button id="gemma-analyze-btn" class="gemma-action-btn">Analyze Current Form</button>
                    <div id="gemma-analysis-result" class="gemma-result"></div>
                </div>
                
                <!-- Map Fields Tab -->
                <div id="gemma-map" class="gemma-tab-content">
                    <p>Map fields between two forms to automate data transfer.</p>
                    <label>Source Form:</label>
                    <select id="gemma-source-form"></select>
                    
                    <label>Target Form:</label>
                    <select id="gemma-target-form"></select>
                    
                    <button id="gemma-map-btn" class="gemma-action-btn">Map Fields</button>
                    <div id="gemma-mapping-result" class="gemma-result"></div>
                </div>
                
                <!-- Plan Automation Tab -->
                <div id="gemma-automate" class="gemma-tab-content">
                    <p>Create an automation plan for filling a form with test data.</p>
                    <label>Form:</label>
                    <select id="gemma-automation-form"></select>
                    
                    <label>Test Data (JSON):</label>
                    <textarea id="gemma-test-data" rows="4" style="width: 100%;"></textarea>
                    
                    <button id="gemma-plan-btn" class="gemma-action-btn">Create Plan</button>
                    <div id="gemma-plan-result" class="gemma-result"></div>
                </div>
                
                <!-- Optimize Workflow Tab -->
                <div id="gemma-optimize" class="gemma-tab-content">
                    <p>Optimize existing workflows for better performance.</p>
                    <label>Workflow:</label>
                    <select id="gemma-workflow-select"></select>
                    
                    <button id="gemma-optimize-btn" class="gemma-action-btn">Optimize Workflow</button>
                    <div id="gemma-optimization-result" class="gemma-result"></div>
                </div>
            </div>
        `;

        // Add CSS
        const style = document.createElement('style');
        style.textContent = `
            .gemma-tabs {
                display: flex;
                border-bottom: 1px solid #e5e7eb;
                margin-bottom: 16px;
                gap: 8px;
            }
            
            .gemma-tab {
                padding: 8px 16px;
                background: #f3f4f6;
                border: none;
                border-radius: 4px 4px 0 0;
                cursor: pointer;
                font-weight: 500;
            }
            
            .gemma-tab:hover {
                background: #e5e7eb;
            }
            
            .gemma-tab.active {
                background: #4f46e5;
                color: white;
            }
            
            .gemma-tab-content {
                display: none;
            }
            
            .gemma-tab-content.active {
                display: block;
            }
            
            .gemma-action-btn {
                background: #4f46e5;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                margin: 16px 0;
                cursor: pointer;
                font-weight: 500;
            }
            
            .gemma-action-btn:hover {
                background: #4338ca;
            }
            
            .gemma-result {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                padding: 16px;
                margin-top: 16px;
                max-height: 300px;
                overflow: auto;
                white-space: pre-wrap;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(panel);
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'gemma-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: none;
        `;
        
        document.body.appendChild(overlay);
    }

    setupEventListeners() {
        // Close button
        document.getElementById('gemma-close-btn').addEventListener('click', () => this.hidePanel());
        document.getElementById('gemma-overlay').addEventListener('click', () => this.hidePanel());
        
        // Tab switching
        document.querySelectorAll('.gemma-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.gemma-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.gemma-tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(`gemma-${tab.dataset.tab}`).classList.add('active');
            });
        });
        
        // Analyze Form
        document.getElementById('gemma-analyze-btn').addEventListener('click', async () => {
            try {
                const webview = document.querySelector('webview');
                if (!webview) {
                    this.showResult('gemma-analysis-result', { error: 'No active webview found' });
                    return;
                }
                
                // Get the current page content
                const pageContent = await webview.executeJavaScript(`
                    document.documentElement.outerHTML;
                `);
                const url = await webview.executeJavaScript('window.location.href');
                
                const result = await window.gemma.analyzeForm(pageContent, url);
                this.showResult('gemma-analysis-result', result);
            } catch (error) {
                this.showResult('gemma-analysis-result', { error: error.message });
            }
        });
        
        // Map Fields
        document.getElementById('gemma-map-btn').addEventListener('click', async () => {
            const sourceForm = document.getElementById('gemma-source-form').value;
            const targetForm = document.getElementById('gemma-target-form').value;
            
            if (!sourceForm || !targetForm) {
                this.showResult('gemma-mapping-result', { error: 'Please select both forms' });
                return;
            }
            
            try {
                const result = await window.gemma.mapFormFields(sourceForm, targetForm);
                this.showResult('gemma-mapping-result', result);
            } catch (error) {
                this.showResult('gemma-mapping-result', { error: error.message });
            }
        });
        
        // Plan Automation
        document.getElementById('gemma-plan-btn').addEventListener('click', async () => {
            const form = document.getElementById('gemma-automation-form').value;
            const testData = document.getElementById('gemma-test-data').value;
            
            if (!form) {
                this.showResult('gemma-plan-result', { error: 'Please select a form' });
                return;
            }
            
            try {
                const data = testData ? JSON.parse(testData) : {};
                const result = await window.gemma.planAutomation(form, data);
                this.showResult('gemma-plan-result', result);
            } catch (error) {
                this.showResult('gemma-plan-result', { error: error.message });
            }
        });
        
        // Optimize Workflow
        document.getElementById('gemma-optimize-btn').addEventListener('click', async () => {
            const workflow = document.getElementById('gemma-workflow-select').value;
            
            if (!workflow) {
                this.showResult('gemma-optimization-result', { error: 'Please select a workflow' });
                return;
            }
            
            try {
                const result = await window.gemma.optimizeWorkflow(workflow);
                this.showResult('gemma-optimization-result', result);
            } catch (error) {
                this.showResult('gemma-optimization-result', { error: error.message });
            }
        });
    }

    showPanel() {
        document.getElementById('gemma-panel').style.display = 'block';
        document.getElementById('gemma-overlay').style.display = 'block';
        
        // Check Gemma initialization when panel is opened
        this.checkGemmaStatus();
        
        // Load form templates and workflows
        this.loadFormTemplates();
        this.loadWorkflows();
    }

    hidePanel() {
        document.getElementById('gemma-panel').style.display = 'none';
        document.getElementById('gemma-overlay').style.display = 'none';
    }

    showResult(elementId, result) {
        const resultElement = document.getElementById(elementId);
        
        if (result.error) {
            resultElement.innerHTML = `<div style="color: #B91C1C; font-weight: bold;">Error: ${result.error}</div>`;
            return;
        }
        
        resultElement.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
    }

    async loadFormTemplates() {
        try {
            // Try using the formTemplate:getAll channel first
            let templates;
            try {
                templates = await window.electron.ipcRenderer.invoke('formTemplate:getAll');
            } catch (error) {
                console.warn('Error using formTemplate:getAll, falling back to legacy channel:', error);
                // Fall back to the legacy formTemplates:get channel
                templates = await window.electron.ipcRenderer.invoke('formTemplates:get');
            }
            
            console.log('Loaded form templates:', templates);
            
            // Update form selection dropdowns
            ['gemma-source-form', 'gemma-target-form', 'gemma-automation-form'].forEach(selectId => {
                const select = document.getElementById(selectId);
                if (!select) return;
                
                select.innerHTML = '<option value="">Select a form template...</option>';
                
                if (templates && typeof templates === 'object') {
                    Object.entries(templates).forEach(([name, template]) => {
                        const option = document.createElement('option');
                        option.value = name;
                        option.textContent = name;
                        select.appendChild(option);
                    });
                }
            });
        } catch (error) {
            console.error('Error loading form templates:', error);
        }
    }

    async loadWorkflows() {
        try {
            const workflows = await window.electron.ipcRenderer.invoke('workflow:getWorkflows');
            const select = document.getElementById('gemma-workflow-select');
            select.innerHTML = '<option value="">Select a workflow...</option>';
            
            Object.entries(workflows).forEach(([name, workflow]) => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading workflows:', error);
        }
    }

    async checkGemmaStatus() {
        try {
            // Try a simple call to check if Gemma is initialized
            await window.gemma.analyzeForm('', '');
            this.isInitialized = true;
            
            // Remove any existing instructions panel
            const existingInstructions = document.getElementById('gemma-instructions');
            if (existingInstructions) {
                existingInstructions.remove();
            }
        } catch (error) {
            this.isInitialized = false;
            this.showGemmaInstructions();
        }
    }

    showGemmaInstructions() {
        let instructionsPanel = document.getElementById('gemma-instructions');
        
        if (!instructionsPanel) {
            instructionsPanel = document.createElement('div');
            instructionsPanel.id = 'gemma-instructions';
            instructionsPanel.style.cssText = `
                background: #FEF3C7;
                border: 1px solid #F59E0B;
                border-radius: 4px;
                padding: 16px;
                margin-bottom: 20px;
            `;
            
            document.querySelector('.gemma-content').insertBefore(
                instructionsPanel,
                document.querySelector('.gemma-content').firstChild
            );
        }
        
        instructionsPanel.innerHTML = `
            <h3 style="margin: 0 0 8px 0; color: #B45309;">Gemma Model Setup Required</h3>
            <p style="margin: 0 0 12px 0;">To use Gemma's features, you need to pull the model first. Please follow these steps:</p>
            <ol style="margin: 0; padding-left: 20px;">
                <li>Make sure Ollama is installed and running</li>
                <li>Open a terminal or command prompt</li>
                <li>Run the command: <code style="background: #F3F4F6; padding: 2px 4px; border-radius: 2px;">ollama pull gemma3:4b</code></li>
                <li>Wait for the download to complete (this may take some time)</li>
                <li>Restart the application</li>
            </ol>
        `;
    }
}

// Initialize GemmaUI and expose to window
window.gemmaUI = new GemmaUI();

// Check if DOMContentLoaded already fired
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Initializing Gemma UI after DOM loaded');
    });
} else {
    console.log('Initializing Gemma UI (DOM already loaded)');
}

// Initialize the UI
window.addEventListener('DOMContentLoaded', () => {
    window.gemmaUI = new GemmaUI();
    
    // Add button to open Gemma panel
    const gemmaButton = document.createElement('button');
    gemmaButton.id = 'gemma-btn';
    gemmaButton.title = 'Gemma Assistant';
    gemmaButton.style.cssText = `
        background: #4f46e5;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        margin-left: 5px;
        cursor: pointer;
    `;
    gemmaButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm.5 5a.5.5 0 0 1 0 1h-1a.5.5 0 0 1 0-1h1zm0 2.5a.5.5 0 0 1 0 1h-1a.5.5 0 0 1 0-1h1zm-2 2a.5.5 0 0 1 0 1h-1a.5.5 0 0 1 0-1h1zm5 0a.5.5 0 0 1 0 1h-1a.5.5 0 0 1 0-1h1z"/>
        </svg>
    `;
    
    const urlBarContainer = document.querySelector('.url-bar-container');
    if (urlBarContainer) {
        urlBarContainer.appendChild(gemmaButton);
        
        gemmaButton.addEventListener('click', () => {
            window.gemmaUI.showPanel();
        });
    }
}); 