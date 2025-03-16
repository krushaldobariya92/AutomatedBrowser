const { ipcMain } = require('electron');
const fetch = require('node-fetch');

class GemmaIntegration {
    constructor() {
        this.initialized = false;
        this.modelName = 'gemma3:4b';
        this.ollamaEndpoint = 'http://localhost:11434';
        this.setupIpcHandlers();
        this.fallbackResponses = {
            navigation: "I can help you navigate to that website.",
            search: "I'll search for that information.",
            notAvailable: "I'm sorry, I can't process your request right now. The language model service isn't available."
        };
    }

    async checkModelAvailability() {
        try {
            // Check if Ollama service is running
            const serviceCheck = await fetch(`${this.ollamaEndpoint}/api/tags`).catch(() => null);
            if (!serviceCheck) {
                console.warn('Ollama service not available');
                throw new Error('Ollama service not available. Please start Ollama first.');
            }

            // Check if model is already pulled
            const response = await fetch(`${this.ollamaEndpoint}/api/tags`);
            const tags = await response.json();
            
            const modelExists = tags.models.some(model => 
                model.name === this.modelName
            );

            if (!modelExists) {
                console.warn(`Model ${this.modelName} not found`);
                throw new Error(
                    `Model ${this.modelName} not found. Please run the following command first:\n` +
                    `ollama pull ${this.modelName}`
                );
            }

            return true;
        } catch (error) {
            console.error('Model availability check failed:', error);
            return false;
        }
    }

    async initialize() {
        if (this.initialized) return true;

        try {
            const available = await this.checkModelAvailability();
            
            if (!available) {
                console.warn('Model not available, Gemma will run in fallback mode');
                return false;
            }
            
            console.log(`Gemma initialized with model: ${this.modelName}`);
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize Gemma:', error);
            return false;
        }
    }

    setupIpcHandlers() {
        // Form Analysis
        ipcMain.handle('gemma:analyze-form', async (event, { pageContent, url }) => {
            return await this.analyzeForm(pageContent, url);
        });

        // Form Field Mapping
        ipcMain.handle('gemma:map-fields', async (event, { sourceForm, targetForm }) => {
            return await this.mapFormFields(sourceForm, targetForm);
        });

        // Form Automation Planning
        ipcMain.handle('gemma:plan-automation', async (event, { form, testData }) => {
            return await this.planAutomation(form, testData);
        });

        // Workflow Optimization
        ipcMain.handle('gemma:optimize-workflow', async (event, { workflow }) => {
            return await this.optimizeWorkflow(workflow);
        });
    }

    async analyzeForm(pageContent, url) {
        if (!this.initialized) {
            const initialized = await this.initialize();
            if (!initialized) {
                console.warn('Gemma not initialized during analyzeForm call');
                return { 
                    success: false, 
                    message: 'Language model service unavailable',
                    analysis: {
                        action: 'RESPOND',
                        response: this.fallbackResponses.notAvailable
                    }
                };
            }
        }

        // Truncate page content if it's too large
        const maxContentLength = 2000;
        let truncatedContent = pageContent;
        if (pageContent && pageContent.length > maxContentLength) {
            console.log(`Truncating page content from ${pageContent.length} to ${maxContentLength} characters`);
            truncatedContent = pageContent.substring(0, maxContentLength) + '...';
        }

        try {
            console.log(`Analyzing content for URL: ${url}`);
            
            // Prepare the prompt with context
            const prompt = `
            You are a helpful AI assistant for a browser automation system.
            ${url ? `The current page URL is: ${url}` : ''}
            
            ${truncatedContent ? 'Page content: ' + truncatedContent : 'No page content available'}
            
            Analyze this content and respond with a JSON object containing:
            {
              "formFields": [
                {
                  "name": "field name or id",
                  "label": "human-readable label",
                  "type": "text|password|email|checkbox|radio|select",
                  "options": ["option1", "option2"], // Only for select fields
                  "required": true|false,
                  "defaultValue": "any default value"
                }
              ],
              "purpose": "brief description of what this form is for",
              "action": "what happens when this form is submitted",
              "suggestions": ["suggestion1", "suggestion2"] // suggestions for automating this form
            }
            
            If no form is present, return:
            {
              "formFields": [],
              "purpose": "no form detected",
              "suggestions": []
            }
            `;
            
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: prompt,
                    stream: false
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed with status: ${response.status}`);
            }
            
            const result = await response.json();
            const formAnalysis = result.response || '';
            
            try {
                // Extract JSON from the response
                const jsonRegex = /{[\s\S]*}/;
                const jsonMatch = formAnalysis.match(jsonRegex);
                
                if (!jsonMatch) {
                    console.warn('No JSON found in response:', formAnalysis);
                    return {
                        success: false,
                        message: 'Invalid response format from language model',
                        rawResponse: formAnalysis
                    };
                }
                
                const parsedAnalysis = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    analysis: parsedAnalysis
                };
            } catch (parseError) {
                console.error('Error parsing form analysis:', parseError);
                console.log('Raw form analysis:', formAnalysis);
                
                // Attempt to extract useful information even if JSON parsing fails
                return {
                    success: false,
                    message: 'Failed to parse analysis',
                    rawResponse: formAnalysis
                };
            }
        } catch (error) {
            console.error('Error analyzing form:', error);
            return {
                success: false,
                message: error.message,
                analysis: {
                    action: 'RESPOND',
                    response: 'Sorry, I had trouble analyzing this page. Could you try again?'
                }
            };
        }
    }

    async mapFormFields(sourceForm, targetForm) {
        if (!this.initialized) {
            const initialized = await this.initialize();
            if (!initialized) {
                return { success: false, message: 'Gemma not initialized' };
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
                throw new Error('Failed to get response from Gemma');
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
                return { success: false, message: 'Gemma not initialized' };
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
                throw new Error('Failed to get response from Gemma');
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
                return { success: false, message: 'Gemma not initialized' };
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
                throw new Error('Failed to get response from Gemma');
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

const gemmaInstance = new GemmaIntegration();
module.exports = gemmaInstance; 