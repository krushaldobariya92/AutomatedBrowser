const { ipcMain } = require('electron');
const fetch = require('node-fetch');

class R1Integration {
    constructor() {
        this.initialized = false;
        this.modelName = 'deepseek-coder:8b';
        this.ollamaEndpoint = 'http://localhost:11434';
        this.setupIpcHandlers();
    }

    async checkModelAvailability() {
        try {
            // Check if Ollama service is running
            const serviceCheck = await fetch(`${this.ollamaEndpoint}/api/tags`).catch(() => null);
            if (!serviceCheck) {
                throw new Error('Ollama service not available. Please start Ollama first.');
            }

            // Check if model is already pulled
            const response = await fetch(`${this.ollamaEndpoint}/api/tags`);
            const tags = await response.json();
            
            const modelExists = tags.models.some(model => 
                model.name === this.modelName
            );

            if (!modelExists) {
                throw new Error(
                    `Model ${this.modelName} not found. Please run the following command first:\n` +
                    `ollama pull ${this.modelName}`
                );
            }

            return true;
        } catch (error) {
            console.error('Model availability check failed:', error);
            throw error;
        }
    }

    async initialize() {
        if (this.initialized) return true;

        try {
            await this.checkModelAvailability();

            // Verify model is working
            console.log('Verifying R1 model...');
            const testResponse = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: 'Return "ok" if you can read this.',
                    stream: false
                })
            });

            if (!testResponse.ok) {
                throw new Error('Model verification failed');
            }

            this.initialized = true;
            console.log('R1 model initialized successfully');
            return true;
        } catch (error) {
            console.error('Error during R1 initialization:', error);
            if (error.message.includes('Please run the following command')) {
                // This is a model not found error, we want to show this message
                throw error;
            }
            return false;
        }
    }

    setupIpcHandlers() {
        // Form Analysis
        ipcMain.handle('r1:analyze-form', async (event, { pageContent, url }) => {
            return await this.analyzeForm(pageContent, url);
        });

        // Form Field Mapping
        ipcMain.handle('r1:map-fields', async (event, { sourceForm, targetForm }) => {
            return await this.mapFormFields(sourceForm, targetForm);
        });

        // Form Automation Planning
        ipcMain.handle('r1:plan-automation', async (event, { form, testData }) => {
            return await this.planAutomation(form, testData);
        });

        // Workflow Optimization
        ipcMain.handle('r1:optimize-workflow', async (event, { workflow }) => {
            return await this.optimizeWorkflow(workflow);
        });
    }

    async analyzeForm(pageContent, url) {
        if (!this.initialized) {
            const initialized = await this.initialize();
            if (!initialized) {
                return { success: false, message: 'R1 not initialized' };
            }
        }

        const prompt = `Analyze this HTML form and provide a detailed understanding of its structure and purpose.

HTML Content:
${pageContent}

URL: ${url}

Provide analysis in JSON format:
{
    "formPurpose": "detailed description of form's purpose",
    "fields": [
        {
            "name": "field name",
            "type": "field type",
            "purpose": "field's purpose",
            "validation": {
                "required": boolean,
                "pattern": "validation pattern if any",
                "constraints": ["list of constraints"]
            },
            "relationships": ["related fields"],
            "selector": "precise CSS selector",
            "automationHints": ["suggestions for automation"]
        }
    ],
    "workflow": {
        "dependencies": ["field dependencies"],
        "sequence": ["optimal fill sequence"],
        "validations": ["validation points"]
    }
}`;

        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt,
                    stream: false,
                    options: {
                        temperature: 0.1,
                        num_predict: 2000
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response from R1');
            }

            const result = await response.json();
            return {
                success: true,
                analysis: JSON.parse(result.response)
            };
        } catch (error) {
            console.error('Error in form analysis:', error);
            return {
                success: false,
                message: 'Form analysis failed',
                error: error.message
            };
        }
    }

    async mapFormFields(sourceForm, targetForm) {
        if (!this.initialized) {
            const initialized = await this.initialize();
            if (!initialized) {
                return { success: false, message: 'R1 not initialized' };
            }
        }

        const prompt = `Map fields between these two forms based on their purpose and structure.

Source Form:
${JSON.stringify(sourceForm, null, 2)}

Target Form:
${JSON.stringify(targetForm, null, 2)}

Provide mapping in JSON format:
{
    "mappings": [
        {
            "sourceField": "source field details",
            "targetField": "target field details",
            "confidence": "confidence score 0-1",
            "transformations": ["any needed data transformations"]
        }
    ],
    "unmappedSource": ["source fields without mapping"],
    "unmappedTarget": ["target fields without mapping"]
}`;

        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt,
                    stream: false,
                    options: {
                        temperature: 0.1,
                        num_predict: 2000
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response from R1');
            }

            const result = await response.json();
            return {
                success: true,
                mapping: JSON.parse(result.response)
            };
        } catch (error) {
            console.error('Error in field mapping:', error);
            return {
                success: false,
                message: 'Field mapping failed',
                error: error.message
            };
        }
    }

    async planAutomation(form, data) {
        if (!this.initialized) {
            const initialized = await this.initialize();
            if (!initialized) {
                return { success: false, message: 'R1 not initialized' };
            }
        }

        const prompt = `Create an automation plan for filling this form with the provided data.

Form Structure:
${JSON.stringify(form, null, 2)}

Data to Fill:
${JSON.stringify(data, null, 2)}

Provide plan in JSON format:
{
    "steps": [
        {
            "action": "action type",
            "field": "target field",
            "value": "value to set",
            "selector": "CSS selector",
            "validation": "validation check",
            "errorHandling": "error handling strategy"
        }
    ],
    "validations": [
        {
            "type": "validation type",
            "target": "validation target",
            "expectedResult": "expected outcome"
        }
    ],
    "errorRecovery": [
        {
            "error": "potential error",
            "strategy": "recovery strategy"
        }
    ]
}`;

        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt,
                    stream: false,
                    options: {
                        temperature: 0.1,
                        num_predict: 2000
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response from R1');
            }

            const result = await response.json();
            return {
                success: true,
                plan: JSON.parse(result.response)
            };
        } catch (error) {
            console.error('Error in automation planning:', error);
            return {
                success: false,
                message: 'Automation planning failed',
                error: error.message
            };
        }
    }

    async optimizeWorkflow(workflow) {
        if (!this.initialized) {
            const initialized = await this.initialize();
            if (!initialized) {
                return { success: false, message: 'R1 not initialized' };
            }
        }

        const prompt = `Analyze and optimize this workflow for efficiency and reliability.

Current Workflow:
${JSON.stringify(workflow, null, 2)}

Provide optimization in JSON format:
{
    "optimizedSteps": [
        {
            "originalStep": "original step details",
            "optimizedStep": "optimized step details",
            "improvement": "description of improvement",
            "riskLevel": "risk assessment of change"
        }
    ],
    "recommendations": [
        {
            "type": "recommendation type",
            "description": "detailed description",
            "impact": "expected impact",
            "implementation": "implementation details"
        }
    ],
    "performance": {
        "expectedSpeedup": "estimated improvement",
        "reliabilityImpact": "impact on reliability",
        "tradeoffs": ["list of tradeoffs"]
    }
}`;

        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt,
                    stream: false,
                    options: {
                        temperature: 0.1,
                        num_predict: 2000
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response from R1');
            }

            const result = await response.json();
            return {
                success: true,
                optimization: JSON.parse(result.response)
            };
        } catch (error) {
            console.error('Error in workflow optimization:', error);
            return {
                success: false,
                message: 'Workflow optimization failed',
                error: error.message
            };
        }
    }
}

module.exports = { R1Integration }; 