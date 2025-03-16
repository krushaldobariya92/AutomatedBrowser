// R1 UI Component
class R1UI {
    constructor() {
        this.setupUI();
        this.setupEventListeners();
    }

    setupUI() {
        // Create R1 panel
        const panel = document.createElement('div');
        panel.id = 'r1-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            display: none;
            width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        `;

        // Create panel content
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">R1 Assistant</h2>
                <button id="r1-close-btn" style="background: none; border: none; cursor: pointer;">✕</button>
            </div>
            
            <div class="r1-tabs" style="margin-bottom: 20px;">
                <button class="r1-tab active" data-tab="analyze">Analyze Form</button>
                <button class="r1-tab" data-tab="map">Map Fields</button>
                <button class="r1-tab" data-tab="automate">Plan Automation</button>
                <button class="r1-tab" data-tab="optimize">Optimize Workflow</button>
            </div>
            
            <div class="r1-content">
                <!-- Analyze Form Tab -->
                <div id="r1-analyze" class="r1-tab-content active">
                    <p>Analyze the current form structure and get intelligent insights.</p>
                    <button id="r1-analyze-btn" class="r1-action-btn">Analyze Current Form</button>
                    <div id="r1-analysis-result" class="r1-result"></div>
                </div>
                
                <!-- Map Fields Tab -->
                <div id="r1-map" class="r1-tab-content">
                    <p>Map fields between forms for data transfer.</p>
                    <div style="margin-bottom: 10px;">
                        <label>Source Form:</label>
                        <select id="r1-source-form"></select>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label>Target Form:</label>
                        <select id="r1-target-form"></select>
                    </div>
                    <button id="r1-map-btn" class="r1-action-btn">Map Fields</button>
                    <div id="r1-mapping-result" class="r1-result"></div>
                </div>
                
                <!-- Plan Automation Tab -->
                <div id="r1-automate" class="r1-tab-content">
                    <p>Create an intelligent automation plan for form filling.</p>
                    <div style="margin-bottom: 10px;">
                        <label>Select Form:</label>
                        <select id="r1-automation-form"></select>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label>Test Data:</label>
                        <textarea id="r1-test-data" rows="4" style="width: 100%;"></textarea>
                    </div>
                    <button id="r1-plan-btn" class="r1-action-btn">Create Plan</button>
                    <div id="r1-plan-result" class="r1-result"></div>
                </div>
                
                <!-- Optimize Workflow Tab -->
                <div id="r1-optimize" class="r1-tab-content">
                    <p>Optimize existing workflows for better performance.</p>
                    <div style="margin-bottom: 10px;">
                        <label>Select Workflow:</label>
                        <select id="r1-workflow-select"></select>
                    </div>
                    <button id="r1-optimize-btn" class="r1-action-btn">Optimize Workflow</button>
                    <div id="r1-optimization-result" class="r1-result"></div>
                </div>
            </div>
        `;

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .r1-tabs {
                display: flex;
                gap: 10px;
                border-bottom: 1px solid #ddd;
                padding-bottom: 10px;
            }
            
            .r1-tab {
                padding: 8px 16px;
                border: none;
                background: none;
                cursor: pointer;
                border-radius: 4px;
                transition: background-color 0.3s;
            }
            
            .r1-tab:hover {
                background: #f0f0f0;
            }
            
            .r1-tab.active {
                background: #1E3A8A;
                color: white;
            }
            
            .r1-tab-content {
                display: none;
                padding: 20px 0;
            }
            
            .r1-tab-content.active {
                display: block;
            }
            
            .r1-action-btn {
                background: #1E3A8A;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin: 10px 0;
            }
            
            .r1-action-btn:hover {
                background: #2563EB;
            }
            
            .r1-result {
                margin-top: 20px;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                display: none;
            }
            
            select, textarea {
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                margin-top: 4px;
            }
        `;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'r1-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            display: none;
        `;

        // Add to document
        document.head.appendChild(styles);
        document.body.appendChild(overlay);
        document.body.appendChild(panel);
    }

    setupEventListeners() {
        // Close button and overlay
        document.getElementById('r1-close-btn').addEventListener('click', () => this.hidePanel());
        document.getElementById('r1-overlay').addEventListener('click', () => this.hidePanel());

        // Tab switching
        document.querySelectorAll('.r1-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.r1-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.r1-tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(`r1-${tab.dataset.tab}`).classList.add('active');
            });
        });

        // Form Analysis
        document.getElementById('r1-analyze-btn').addEventListener('click', async () => {
            const webview = document.querySelector('webview.active');
            if (!webview) {
                this.showResult('r1-analysis-result', { error: 'No active webview found' });
                return;
            }

            try {
                const pageContent = await webview.executeJavaScript('document.documentElement.outerHTML');
                const url = await webview.executeJavaScript('window.location.href');
                
                const result = await window.r1.analyzeForm(pageContent, url);
                this.showResult('r1-analysis-result', result);
            } catch (error) {
                this.showResult('r1-analysis-result', { error: error.message });
            }
        });

        // Field Mapping
        document.getElementById('r1-map-btn').addEventListener('click', async () => {
            const sourceForm = document.getElementById('r1-source-form').value;
            const targetForm = document.getElementById('r1-target-form').value;
            
            if (!sourceForm || !targetForm) {
                this.showResult('r1-mapping-result', { error: 'Please select both forms' });
                return;
            }

            try {
                const result = await window.r1.mapFormFields(sourceForm, targetForm);
                this.showResult('r1-mapping-result', result);
            } catch (error) {
                this.showResult('r1-mapping-result', { error: error.message });
            }
        });

        // Automation Planning
        document.getElementById('r1-plan-btn').addEventListener('click', async () => {
            const form = document.getElementById('r1-automation-form').value;
            const testData = document.getElementById('r1-test-data').value;
            
            if (!form) {
                this.showResult('r1-plan-result', { error: 'Please select a form' });
                return;
            }

            try {
                const data = testData ? JSON.parse(testData) : {};
                const result = await window.r1.planAutomation(form, data);
                this.showResult('r1-plan-result', result);
            } catch (error) {
                this.showResult('r1-plan-result', { error: error.message });
            }
        });

        // Workflow Optimization
        document.getElementById('r1-optimize-btn').addEventListener('click', async () => {
            const workflow = document.getElementById('r1-workflow-select').value;
            
            if (!workflow) {
                this.showResult('r1-optimization-result', { error: 'Please select a workflow' });
                return;
            }

            try {
                const result = await window.r1.optimizeWorkflow(workflow);
                this.showResult('r1-optimization-result', result);
            } catch (error) {
                this.showResult('r1-optimization-result', { error: error.message });
            }
        });
    }

    showPanel() {
        document.getElementById('r1-panel').style.display = 'block';
        document.getElementById('r1-overlay').style.display = 'block';
        
        // Check R1 initialization when panel is opened
        this.checkR1Status();
        
        this.updateFormLists();
        this.updateWorkflowList();
    }

    hidePanel() {
        document.getElementById('r1-panel').style.display = 'none';
        document.getElementById('r1-overlay').style.display = 'none';
    }

    showResult(elementId, result) {
        const element = document.getElementById(elementId);
        element.style.display = 'block';
        
        if (result.error) {
            element.innerHTML = `<div style="color: red;">Error: ${result.error}</div>`;
            return;
        }

        element.innerHTML = `<pre style="white-space: pre-wrap;">${JSON.stringify(result, null, 2)}</pre>`;
    }

    async updateFormLists() {
        try {
            const forms = await window.formTemplates.getTemplates();
            const formOptions = Object.entries(forms)
                .map(([name, form]) => `<option value="${name}">${name}</option>`)
                .join('');

            ['r1-source-form', 'r1-target-form', 'r1-automation-form'].forEach(id => {
                const select = document.getElementById(id);
                if (select) select.innerHTML = `<option value="">Select a form...</option>${formOptions}`;
            });
        } catch (error) {
            console.error('Error updating form lists:', error);
        }
    }

    async updateWorkflowList() {
        try {
            const workflows = await window.workflows.getWorkflows();
            const workflowOptions = Object.entries(workflows)
                .map(([name, workflow]) => `<option value="${name}">${name}</option>`)
                .join('');

            const select = document.getElementById('r1-workflow-select');
            if (select) {
                select.innerHTML = `<option value="">Select a workflow...</option>${workflowOptions}`;
            }
        } catch (error) {
            console.error('Error updating workflow list:', error);
        }
    }

    async checkR1Status() {
        try {
            // Try to analyze an empty form to trigger initialization check
            await window.r1.analyzeForm('', '');
        } catch (error) {
            if (error.message.includes('Please run the following command')) {
                // Show model installation instructions
                const instructions = error.message.split('\n');
                this.showModelInstructions(instructions[1]);
                return false;
            } else if (error.message.includes('Ollama service not available')) {
                this.showOllamaInstructions();
                return false;
            }
        }
        return true;
    }

    showModelInstructions(command) {
        // Create or update instructions panel
        let instructionsPanel = document.getElementById('r1-instructions');
        if (!instructionsPanel) {
            instructionsPanel = document.createElement('div');
            instructionsPanel.id = 'r1-instructions';
            instructionsPanel.style.cssText = `
                background: #FEF3C7;
                border: 1px solid #F59E0B;
                border-radius: 4px;
                padding: 16px;
                margin-bottom: 20px;
            `;
            document.querySelector('.r1-content').insertBefore(
                instructionsPanel,
                document.querySelector('.r1-content').firstChild
            );
        }

        instructionsPanel.innerHTML = `
            <h3 style="margin: 0 0 8px 0; color: #B45309;">R1 Model Setup Required</h3>
            <p style="margin: 0 0 12px 0;">To use R1's features, you need to pull the model first. Please follow these steps:</p>
            <ol style="margin: 0 0 12px 0; padding-left: 24px;">
                <li>Open a terminal</li>
                <li>Make sure Ollama is running</li>
                <li>Run this command:</li>
            </ol>
            <div style="background: #1F2937; color: white; padding: 8px 12px; border-radius: 4px; font-family: monospace;">
                ${command}
            </div>
            <p style="margin: 12px 0 0 0; font-size: 0.9em; color: #92400E;">
                Note: This is a one-time setup. The model will be cached for future use.
            </p>
        `;
    }

    showOllamaInstructions() {
        // Create or update instructions panel
        let instructionsPanel = document.getElementById('r1-instructions');
        if (!instructionsPanel) {
            instructionsPanel = document.createElement('div');
            instructionsPanel.id = 'r1-instructions';
            instructionsPanel.style.cssText = `
                background: #FEF3C7;
                border: 1px solid #F59E0B;
                border-radius: 4px;
                padding: 16px;
                margin-bottom: 20px;
            `;
            document.querySelector('.r1-content').insertBefore(
                instructionsPanel,
                document.querySelector('.r1-content').firstChild
            );
        }

        instructionsPanel.innerHTML = `
            <h3 style="margin: 0 0 8px 0; color: #B45309;">Ollama Service Not Running</h3>
            <p style="margin: 0 0 12px 0;">To use R1's features, you need to start the Ollama service first:</p>
            <ol style="margin: 0 0 12px 0; padding-left: 24px;">
                <li>Open a terminal</li>
                <li>Run the Ollama service:</li>
            </ol>
            <div style="background: #1F2937; color: white; padding: 8px 12px; border-radius: 4px; font-family: monospace;">
                ollama serve
            </div>
            <p style="margin: 12px 0 0 0; font-size: 0.9em; color: #92400E;">
                Keep the terminal window open while using R1's features.
            </p>
        `;
    }
}

// Initialize R1 UI
const r1UI = new R1UI();

// Add button to URL bar
const urlBarContainer = document.querySelector('.url-bar-container');
if (urlBarContainer) {
    const r1Button = document.createElement('button');
    r1Button.id = 'r1-btn';
    r1Button.title = 'Open R1 Assistant';
    r1Button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5ZM3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.58 26.58 0 0 0 4.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.933.933 0 0 1-.765.935c-.845.147-2.34.346-4.235.346-1.895 0-3.39-.2-4.235-.346A.933.933 0 0 1 3 9.219V8.062Zm4.542-.827a.25.25 0 0 0-.217.068l-.92.9a24.767 24.767 0 0 1-1.871-.183.25.25 0 0 0-.068.495c.55.076 1.232.149 2.02.193a.25.25 0 0 0 .189-.071l.754-.736.847 1.71a.25.25 0 0 0 .404.062l.932-.97a25.286 25.286 0 0 0 1.922-.188.25.25 0 0 0-.068-.495c-.538.074-1.207.145-1.98.189a.25.25 0 0 0-.166.076l-.754.785-.842-1.7a.25.25 0 0 0-.182-.135Z"/>
            <path d="M8.5 1.866a1 1 0 1 0-1 0V3h-2A4.5 4.5 0 0 0 1 7.5V8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1v-.5A4.5 4.5 0 0 0 10.5 3h-2V1.866ZM14 7.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5A3.5 3.5 0 0 1 5.5 4h5A3.5 3.5 0 0 1 14 7.5Z"/>
        </svg>
    `;
    r1Button.style.cssText = `
        background: #1E3A8A;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        margin-left: 5px;
        cursor: pointer;
    `;
    r1Button.addEventListener('click', () => r1UI.showPanel());
    urlBarContainer.appendChild(r1Button);
}

// Export for potential use in other modules
window.r1UI = r1UI; 