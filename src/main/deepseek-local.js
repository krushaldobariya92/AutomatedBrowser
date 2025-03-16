const { ipcMain } = require('electron');
const fetch = require('node-fetch');

class LocalDeepSeekIntegration {
  constructor() {
    this.initialized = false;
    this.modelName = 'deepseek-coder:8b';
    this.ollamaEndpoint = 'http://localhost:11434';
    this.setupIpcHandlers();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // First check if Ollama service is running
      const serviceCheck = await fetch(`${this.ollamaEndpoint}/api/tags`).catch(() => null);
      if (!serviceCheck) {
        console.warn('Ollama service not available. Please start Ollama first.');
        return false;
      }

      // Check if model exists and pull if needed
      console.log('Checking model availability...');
      const modelCheck = await fetch(`${this.ollamaEndpoint}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.modelName })
      });

      if (!modelCheck.ok) {
        console.log(`Model ${this.modelName} not found locally. Starting download...`);
        
        // Start model pull with progress tracking
        const pullResponse = await fetch(`${this.ollamaEndpoint}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: this.modelName })
        });

        if (!pullResponse.ok) {
          throw new Error(`Failed to pull model: ${pullResponse.statusText}`);
        }

        // Track pull progress
        const reader = pullResponse.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          try {
            const progress = JSON.parse(chunk);
            if (progress.status === 'downloading') {
              console.log(`Downloading model: ${Math.round(progress.completed / progress.total * 100)}%`);
            } else if (progress.status === 'processing') {
              console.log('Processing downloaded files...');
            }
          } catch (e) {
            // Ignore parse errors from incomplete chunks
          }
        }

        console.log('Model download completed');
      } else {
        console.log(`Model ${this.modelName} is already available`);
      }

      // Verify model is ready by sending a test prompt
      console.log('Verifying model...');
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
      console.log('DeepSeek model initialized successfully');
      return true;
    } catch (error) {
      console.error('Error during model initialization:', error);
      return false;
    }
  }

  setupIpcHandlers() {
    // Handle form analysis requests
    ipcMain.handle('deepseek:analyzeForm', async (event, { pageContent, url }) => {
      try {
        if (!this.initialized) {
          const initialized = await this.initialize();
          if (!initialized) {
            return {
              success: false,
              message: 'DeepSeek not initialized. Please ensure Ollama is running.'
            };
          }
        }

        const analysis = await this.analyzeFormWithOllama(pageContent, url);
        return {
          success: true,
          suggestedName: analysis.formName,
          fields: analysis.fields
        };
      } catch (error) {
        console.error('DeepSeek form analysis error:', error);
        return {
          success: false,
          message: 'Form analysis failed'
        };
      }
    });

    // Handle intelligent form filling
    ipcMain.handle('deepseek:fillForm', async (event, { template, pageContent, url }) => {
      try {
        if (!this.initialized) {
          const initialized = await this.initialize();
          if (!initialized) {
            return {
              success: false,
              message: 'DeepSeek not initialized. Please ensure Ollama is running.'
            };
          }
        }

        const fillPlan = await this.planFormFillWithOllama(template, pageContent, url);
        return {
          success: true,
          actions: fillPlan.actions
        };
      } catch (error) {
        console.error('DeepSeek form filling error:', error);
        return {
          success: false,
          message: 'Form filling failed'
        };
      }
    });
  }

  async analyzeFormWithOllama(pageContent, url) {
    const prompt = `You are an expert in form analysis and HTML. Analyze this form and extract all fields with their details.

HTML Content:
${pageContent}

URL: ${url}

Provide a detailed analysis in JSON format with:
{
  "formName": "descriptive name based on form purpose",
  "fields": [
    {
      "name": "field identifier",
      "selector": "precise CSS selector",
      "type": "field type",
      "defaultValue": "default value if any",
      "validation": {
        "required": boolean,
        "pattern": "regex pattern if applicable",
        "minLength": number if applicable,
        "maxLength": number if applicable
      },
      "description": "detailed field purpose"
    }
  ]
}

Focus on accuracy and include all relevant validation rules.`;

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
            num_predict: 1000
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Ollama');
      }

      const result = await response.json();
      const analysis = JSON.parse(result.response);

      if (!analysis.fields || !Array.isArray(analysis.fields)) {
        return this.fallbackAnalysis(pageContent, url);
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing form with Ollama:', error);
      return this.fallbackAnalysis(pageContent, url);
    }
  }

  async planFormFillWithOllama(template, pageContent, url) {
    const prompt = `You are an expert in form automation. Plan how to fill this form based on the template and current page content.

Template:
${JSON.stringify(template, null, 2)}

Current Page Content:
${pageContent}

URL: ${url}

Provide a detailed plan in JSON format with:
{
  "actions": [
    {
      "selector": "precise CSS selector",
      "script": "JavaScript code to execute",
      "description": "what this action does"
    }
  ]
}

Ensure the JavaScript code:
1. Handles different input types correctly
2. Triggers appropriate events (input, change)
3. Validates input before setting
4. Uses proper error handling`;

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
            num_predict: 1000
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Ollama');
      }

      const result = await response.json();
      const plan = JSON.parse(result.response);

      if (!plan.actions || !Array.isArray(plan.actions)) {
        return this.fallbackFillPlan(template);
      }

      return plan;
    } catch (error) {
      console.error('Error planning form fill with Ollama:', error);
      return this.fallbackFillPlan(template);
    }
  }

  fallbackAnalysis(pageContent, url) {
    // Basic HTML parsing to extract form elements
    const elements = [];
    const formRegex = /<input|<select|<textarea[^>]*>/gi;
    let match;

    while ((match = formRegex.exec(pageContent)) !== null) {
      const element = match[0];
      const nameMatch = element.match(/name=["']([^"']+)["']/);
      const typeMatch = element.match(/type=["']([^"']+)["']/);
      const idMatch = element.match(/id=["']([^"']+)["']/);

      elements.push({
        name: nameMatch ? nameMatch[1] : null,
        type: typeMatch ? typeMatch[1] : 'text',
        selector: idMatch ? `#${idMatch[1]}` : `[name="${nameMatch ? nameMatch[1] : ''}"]`
      });
    }

    return {
      formName: `Form - ${new URL(url).hostname}`,
      fields: elements.map(el => ({
        name: el.name || this.inferFieldName(el),
        selector: el.selector,
        type: el.type,
        defaultValue: '',
        validation: this.inferValidation(el),
        description: this.inferDescription(el)
      }))
    };
  }

  fallbackFillPlan(template) {
    return {
      actions: template.fields.map(field => ({
        selector: field.selector,
        script: `
          element.value = ${JSON.stringify(field.value)};
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        `
      }))
    };
  }

  inferFieldName(element) {
    if (element.type === 'email') return 'email';
    if (element.type === 'password') return 'password';
    if (element.type === 'tel') return 'phone';
    return element.name || 'field';
  }

  inferValidation(element) {
    const validation = { required: false };
    
    if (element.type === 'email') {
      validation.pattern = '^[^@]+@[^@]+\\.[^@]+$';
    } else if (element.type === 'password') {
      validation.minLength = 8;
    } else if (element.type === 'tel') {
      validation.pattern = '^[0-9+\\-() ]+$';
    }

    return validation;
  }

  inferDescription(element) {
    if (element.type === 'email') return 'Email address field';
    if (element.type === 'password') return 'Password field';
    if (element.type === 'tel') return 'Phone number field';
    if (element.type === 'checkbox') return 'Checkbox field';
    if (element.type === 'radio') return 'Radio button field';
    return 'Text input field';
  }
}

module.exports = new LocalDeepSeekIntegration(); 