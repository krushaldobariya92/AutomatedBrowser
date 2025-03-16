const { app, BrowserWindow, session, Menu, ipcMain, dialog } = require('electron');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const url = require('url');
const formTemplates = require('./src/main/form-templates');
const deepseek = require('./src/main/deepseek-local');
const gemma = require('./src/zak/gemma');
const workflowsModule = require('./src/main/workflows');

// Global reference to the main window
let win;

// Create main window
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { 
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src/renderer/main-preload.js'),
      webviewTag: true, // Enable webview tag
      webSecurity: false, // Disable web security for development
      allowRunningInsecureContent: true, // Allow running insecure content
      enableRemoteModule: true // Enable remote module for webview
    }
  });
  
  // Load the renderer
  win.loadFile(path.join(__dirname, 'src/renderer/index.html'));
  
  // Open DevTools in development
  win.webContents.openDevTools();
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            win.webContents.send('new-tab');
          }
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            win.webContents.send('close-tab');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            win.webContents.send('reload-tab');
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            win.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'Automation',
      submenu: [
        {
          label: 'Workflow Manager',
          click: () => {
            win.webContents.send('show-workflow-panel');
          }
        },
        {
          label: 'Form Templates',
          click: () => {
            win.webContents.send('show-template-panel');
          }
        },
        { type: 'separator' },
        {
          label: 'Start Recording',
          click: () => {
            win.webContents.send('start-recording');
          }
        },
        {
          label: 'Stop Recording',
          click: () => {
            win.webContents.send('stop-recording');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(win, {
              title: 'About Automated Browser',
              message: 'Automated Browser with Zak Assistant',
              detail: 'Version 1.0.0\nAn Electron-based autonomous web browser with integrated AI assistant and workflow automation.'
            });
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Import our modules
console.log('Checking for workflows.js file...');
const workflowsPath = path.join(__dirname, 'src', 'main', 'workflows.js');
if (fs.existsSync(workflowsPath)) {
  console.log('Workflows module found at:', workflowsPath);
} else {
  console.error('Workflows module not found at:', workflowsPath);
}

// Initialize workflows
try {
  workflowsModule.initialize();
  console.log('Workflows module imported successfully');
} catch (error) {
  console.error('Error importing workflows module:', error);
  // Fallback to direct initialization if module fails to load
  const workflowsDir = path.join(__dirname, 'data');
  console.log('Workflows directory:', workflowsDir);
  
  // Ensure data directory exists
  if (!fs.existsSync(workflowsDir)) {
    console.log('Creating workflow directory');
    fs.mkdirSync(workflowsDir, { recursive: true });
  }
  
  let isRecording = false;
  let currentWorkflow = [];
  let workflowName = '';
  let activeWorkflows = {};
  let scheduledWorkflows = {};
  
  // Helper function to schedule workflow execution
  function scheduleWorkflow(workflow, schedule) {
    const workflowId = workflow.id;
    
    // Clear any existing schedule for this workflow
    if (scheduledWorkflows[workflowId]) {
      clearTimeout(scheduledWorkflows[workflowId].timeout);
      delete scheduledWorkflows[workflowId];
    }
    
    // Calculate next run time
    let nextRun;
    if (schedule.type === 'once') {
      nextRun = new Date(schedule.datetime).getTime();
    } else if (schedule.type === 'recurring') {
      // For recurring schedules, calculate next occurrence
      nextRun = calculateNextRun(schedule);
    }
    
    if (nextRun <= Date.now()) {
      console.log('Schedule is in the past, not scheduling');
      return false;
    }
    
    // Schedule the workflow
    const timeout = setTimeout(async () => {
      console.log(`Executing scheduled workflow: ${workflow.name}`);
      
      try {
        // Run the workflow
        activeWorkflows[workflowId] = {
          id: workflowId,
          name: workflow.name,
          currentStep: 0,
          steps: workflow.steps,
          startedAt: Date.now()
        };
        
        // If recurring, schedule next run
        if (schedule.type === 'recurring') {
          scheduleWorkflow(workflow, schedule);
        }
        
        // Update last run timestamp
        const workflowData = JSON.parse(fs.readFileSync(path.join(workflowsDir, 'workflows.json'), 'utf8')) || {};
        workflowData[workflow.name].lastRun = Date.now();
        fs.writeFileSync(path.join(workflowsDir, 'workflows.json'), JSON.stringify(workflowData, null, 2), 'utf8');
      } catch (error) {
        console.error('Error executing scheduled workflow:', error);
      }
    }, nextRun - Date.now());
    
    scheduledWorkflows[workflowId] = {
      workflow,
      schedule,
      timeout,
      nextRun
    };
    
    return true;
  }
  
  // Helper function to calculate next run time for recurring schedules
  function calculateNextRun(schedule) {
    const now = Date.now();
    let nextRun = new Date();
    
    switch (schedule.interval) {
      case 'hourly':
        nextRun.setHours(nextRun.getHours() + 1);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);
        break;
      
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(schedule.hour || 0);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);
        break;
      
      case 'weekly':
        const targetDay = schedule.dayOfWeek || 0;
        const currentDay = nextRun.getDay();
        const daysToAdd = (targetDay + 7 - currentDay) % 7;
        nextRun.setDate(nextRun.getDate() + daysToAdd);
        nextRun.setHours(schedule.hour || 0);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);
        break;
      
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(schedule.dayOfMonth || 1);
        nextRun.setHours(schedule.hour || 0);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);
        break;
    }
    
    // If next run is in the past, add one more interval
    while (nextRun.getTime() <= now) {
      switch (schedule.interval) {
        case 'hourly':
          nextRun.setHours(nextRun.getHours() + 1);
          break;
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
      }
    }
    
    return nextRun.getTime();
  }
  
  // Set up IPC handlers
  ipcMain.handle('workflow:startRecording', (event, name) => {
    console.log('IPC: Start recording workflow', name);
    
    if (isRecording) {
      return { success: false, message: 'Already recording a workflow' };
    }
    
    if (!name) {
      return { success: false, message: 'Workflow name is required' };
    }
    
    // Reset current workflow
    currentWorkflow = [];
    workflowName = name;
    isRecording = true;
    
    return { success: true, message: `Started recording workflow: ${name}` };
  });
  
  ipcMain.handle('workflow:stopRecording', async (event) => {
    console.log('IPC: Stop recording workflow');
    
    if (!isRecording) {
      return { success: false, message: 'Not currently recording a workflow' };
    }
    
    isRecording = false;
    
    if (currentWorkflow.length === 0) {
      return { success: false, message: 'No steps recorded' };
    }
    
    try {
      // Save workflow to file
      const workflowData = JSON.parse(fs.readFileSync(path.join(workflowsDir, 'workflows.json'), 'utf8')) || {};
      
      // Generate a unique ID for the workflow
      const workflowId = Date.now().toString();
      
      workflowData[workflowName] = {
        id: workflowId,
        name: workflowName,
        steps: currentWorkflow,
        createdAt: Date.now()
      };
      
      fs.writeFileSync(path.join(workflowsDir, 'workflows.json'), JSON.stringify(workflowData, null, 2), 'utf8');
      
      return { success: true, message: `Saved workflow: ${workflowName} with ${currentWorkflow.length} steps` };
    } catch (error) {
      console.error('Error saving workflow:', error);
      return { success: false, message: `Error saving workflow: ${error.message}` };
    }
  });
  
  ipcMain.handle('workflow:recordStep', (event, step) => {
    console.log('IPC: Record step', step.type);
    if (!isRecording) {
      return { success: false, message: 'Not currently recording' };
    }
    
    // Add timestamp to the step
    step.timestamp = Date.now();
    currentWorkflow.push(step);
    
    return { 
      success: true, 
      message: 'Step recorded',
      step
    };
  });
  
  ipcMain.handle('workflow:getWorkflows', () => {
    console.log('IPC: Get workflows');
    try {
      const workflowData = JSON.parse(fs.readFileSync(path.join(workflowsDir, 'workflows.json'), 'utf8')) || {};
      return workflowData;
    } catch (error) {
      console.error('Error loading workflows:', error);
      return {};
    }
  });
  
  ipcMain.handle('workflow:runWorkflow', (event, name) => {
    console.log('IPC: Run workflow', name);
    try {
      const workflowData = JSON.parse(fs.readFileSync(path.join(workflowsDir, 'workflows.json'), 'utf8')) || {};
      
      if (!workflowData[name]) {
        return { success: false, message: `Workflow not found: ${name}` };
      }
      
      const workflow = workflowData[name];
      const workflowId = workflow.id;
      
      // Don't run the same workflow multiple times
      if (activeWorkflows[workflowId]) {
        return { success: false, message: `Workflow is already running: ${name}` };
      }
      
      activeWorkflows[workflowId] = {
        id: workflowId,
        name,
        currentStep: 0,
        steps: workflow.steps,
        startedAt: Date.now()
      };
      
      // Update last run timestamp
      workflowData[name].lastRun = Date.now();
      fs.writeFileSync(path.join(workflowsDir, 'workflows.json'), JSON.stringify(workflowData, null, 2), 'utf8');
      
      return { 
        success: true, 
        message: `Started workflow: ${name}`,
        workflowId
      };
    } catch (error) {
      console.error('Error running workflow:', error);
      return { success: false, message: `Error running workflow: ${error.message}` };
    }
  });
  
  ipcMain.handle('workflow:getNextStep', (event, workflowId) => {
    console.log('IPC: Get next step for workflow', workflowId);
    if (!activeWorkflows[workflowId]) {
      return { success: false, message: 'Workflow not found or not running' };
    }
    
    const workflow = activeWorkflows[workflowId];
    
    if (workflow.currentStep >= workflow.steps.length) {
      // Workflow is complete
      delete activeWorkflows[workflowId];
      return { success: true, complete: true, message: 'Workflow complete' };
    }
    
    const step = workflow.steps[workflow.currentStep];
    workflow.currentStep++;
    
    return { 
      success: true, 
      complete: false,
      step,
      currentStep: workflow.currentStep,
      totalSteps: workflow.steps.length
    };
  });
  
  ipcMain.handle('workflow:deleteWorkflow', (event, name) => {
    console.log('IPC: Delete workflow', name);
    try {
      const workflowData = JSON.parse(fs.readFileSync(path.join(workflowsDir, 'workflows.json'), 'utf8')) || {};
      
      if (!workflowData[name]) {
        return { success: false, message: `Workflow not found: ${name}` };
      }
      
      delete workflowData[name];
      
      fs.writeFileSync(path.join(workflowsDir, 'workflows.json'), JSON.stringify(workflowData, null, 2), 'utf8');
      
      return { success: true, message: `Deleted workflow: ${name}` };
    } catch (error) {
      console.error('Error deleting workflow:', error);
      return { success: false, message: `Error deleting workflow: ${error.message}` };
    }
  });
  
  // Add new IPC handlers for scheduling
  ipcMain.handle('workflow:schedule', (event, { name, schedule }) => {
    console.log('IPC: Schedule workflow', name, schedule);
    try {
      const workflowData = JSON.parse(fs.readFileSync(path.join(workflowsDir, 'workflows.json'), 'utf8')) || {};
      
      if (!workflowData[name]) {
        return { success: false, message: `Workflow not found: ${name}` };
      }
      
      const workflow = workflowData[name];
      
      // Add schedule to workflow
      workflow.schedule = schedule;
      
      // Save updated workflow
      fs.writeFileSync(path.join(workflowsDir, 'workflows.json'), JSON.stringify(workflowData, null, 2), 'utf8');
      
      // Schedule the workflow
      const scheduled = scheduleWorkflow(workflow, schedule);
      
      return { 
        success: true, 
        message: scheduled ? 
          `Scheduled workflow: ${name} (Next run: ${new Date(scheduledWorkflows[workflow.id].nextRun).toLocaleString()})` : 
          'Schedule is in the past, not scheduled',
        nextRun: scheduled ? scheduledWorkflows[workflow.id].nextRun : null
      };
    } catch (error) {
      console.error('Error scheduling workflow:', error);
      return { success: false, message: `Error scheduling workflow: ${error.message}` };
    }
  });
  
  ipcMain.handle('workflow:unschedule', (event, name) => {
    console.log('IPC: Unschedule workflow', name);
    try {
      const workflowData = JSON.parse(fs.readFileSync(path.join(workflowsDir, 'workflows.json'), 'utf8')) || {};
      
      if (!workflowData[name]) {
        return { success: false, message: `Workflow not found: ${name}` };
      }
      
      const workflow = workflowData[name];
      
      // Clear schedule
      if (scheduledWorkflows[workflow.id]) {
        clearTimeout(scheduledWorkflows[workflow.id].timeout);
        delete scheduledWorkflows[workflow.id];
      }
      
      // Remove schedule from workflow
      delete workflow.schedule;
      
      // Save updated workflow
      fs.writeFileSync(path.join(workflowsDir, 'workflows.json'), JSON.stringify(workflowData, null, 2), 'utf8');
      
      return { 
        success: true, 
        message: `Removed schedule for workflow: ${name}`
      };
    } catch (error) {
      console.error('Error unscheduling workflow:', error);
      return { success: false, message: `Error removing schedule: ${error.message}` };
    }
  });
  
  ipcMain.handle('workflow:getSchedule', (event, name) => {
    console.log('IPC: Get workflow schedule', name);
    try {
      const workflowData = JSON.parse(fs.readFileSync(path.join(workflowsDir, 'workflows.json'), 'utf8')) || {};
      
      if (!workflowData[name]) {
        return { success: false, message: `Workflow not found: ${name}` };
      }
      
      const workflow = workflowData[name];
      const workflowId = workflow.id;
      
      if (!workflow.schedule) {
        return { success: true, scheduled: false };
      }
      
      return { 
        success: true, 
        scheduled: true,
        schedule: workflow.schedule,
        nextRun: scheduledWorkflows[workflowId]?.nextRun
      };
    } catch (error) {
      console.error('Error getting workflow schedule:', error);
      return { success: false, message: `Error getting schedule: ${error.message}` };
    }
  });
  
  console.log('Workflow system initialized');
}

// Enable webview support
app.commandLine.appendSwitch('enable-features', 'WebViewTag');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

app.whenReady().then(async () => {
  createWindow();
  
  // Initialize modules
  const dataDir = path.join(__dirname, 'data');
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize modules with proper data directory
  workflowsModule.initialize(dataDir);
  const templatesController = formTemplates.initialize(dataDir);
  
  // Register the formTemplates:get handler for compatibility with older code
  ipcMain.handle('formTemplates:get', async () => {
    console.log('Legacy formTemplates:get handler called');
    return templatesController.model.getTemplates();
  });
  
  // Also register the new channel name
  ipcMain.handle('formTemplate:getAll', async () => {
    console.log('formTemplate:getAll handler called');
    return templatesController.model.getTemplates();
  });
  
  // Initialize DeepSeek with local model
  const initialized = await deepseek.initialize();
  if (!initialized) {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'AI Features Limited',
      message: 'Some AI features are currently limited',
      detail: 'To enable all AI features, please:\n1. Make sure Ollama is running\n2. Run the command: ollama pull deepseek-coder:8b\n\nYou can still use the browser normally.'
    });
  }
  
  // Initialize Gemma
  const gemmaInitialized = await gemma.initialize().catch(err => {
    console.warn('Gemma initialization error:', err);
    return false;
  });
  
  if (!gemmaInitialized) {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Gemma Features Limited',
      message: 'Gemma AI features are currently limited',
      detail: 'To enable Gemma AI features, please:\n1. Make sure Ollama is running\n2. Run the command: ollama pull gemma3:4b\n\nYou can still use the browser normally.'
    });
  } else {
    console.log('Gemma initialized successfully');
  }
  
  // Create application menu
  createMenu();
  
  // Ad-blocker - but configure it to not block navigation
  const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  blocker.enableBlockingInSession(session.defaultSession);
  
  // Configure session permissions
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' * 'unsafe-inline' 'unsafe-eval' data: blob:"]
      }
    });
  });

  // Don't enforce HTTPS in development
  win.webContents.on('will-navigate', (e, url) => {
    console.log('Main process: will-navigate to', url);
    // Only enforce HTTPS in production
    if (process.env.NODE_ENV === 'production' && !url.startsWith('https')) {
      console.warn('Blocking non-HTTPS URL:', url);
      e.preventDefault();
    }
  });

  // Log any errors
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

async function executeWorkflowStep(webContents, step, workflowId) {
  console.log(`Executing workflow step: ${JSON.stringify(step)}`);
  
  try {
    switch (step.type) {
      case 'navigation':
        console.log(`Navigating to: ${step.url}`);
        webContents.loadURL(step.url);
        break;
        
      case 'click':
        console.log(`Clicking element: ${JSON.stringify(step.selector)}`);
        await webContents.executeJavaScript(`
          (function() {
            try {
              const element = document.querySelector(${JSON.stringify(step.selector)});
              if (!element) {
                throw new Error('Element not found: ' + ${JSON.stringify(step.selector)});
              }
              element.click();
              return true;
            } catch (error) {
              console.error('Error clicking element:', error);
              return false;
            }
          })()
        `);
        break;
        
      case 'input':
        console.log(`Filling input: ${JSON.stringify(step.selector)} with value: ${step.value}`);
        await webContents.executeJavaScript(`
          (function() {
            try {
              const element = document.querySelector(${JSON.stringify(step.selector)});
              if (!element) {
                throw new Error('Element not found: ' + ${JSON.stringify(step.selector)});
              }
              
              // Set the value
              element.value = ${JSON.stringify(step.value)};
              
              // Dispatch events to trigger any listeners
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              
              return true;
            } catch (error) {
              console.error('Error filling input:', error);
              return false;
            }
          })()
        `);
        break;
        
      case 'select':
        console.log(`Selecting option: ${JSON.stringify(step.value)} in select: ${JSON.stringify(step.selector)}`);
        await webContents.executeJavaScript(`
          (function() {
            try {
              const element = document.querySelector(${JSON.stringify(step.selector)});
              if (!element) {
                throw new Error('Element not found: ' + ${JSON.stringify(step.selector)});
              }
              
              if (element.tagName.toLowerCase() !== 'select') {
                throw new Error('Element is not a select: ' + ${JSON.stringify(step.selector)});
              }
              
              // Set the value
              element.value = ${JSON.stringify(step.value)};
              
              // Dispatch change event
              element.dispatchEvent(new Event('change', { bubbles: true }));
              
              return true;
            } catch (error) {
              console.error('Error selecting option:', error);
              return false;
            }
          })()
        `);
        break;
        
      case 'checkbox':
        console.log(`Setting checkbox: ${JSON.stringify(step.selector)} to: ${step.checked}`);
        await webContents.executeJavaScript(`
          (function() {
            try {
              const element = document.querySelector(${JSON.stringify(step.selector)});
              if (!element) {
                throw new Error('Element not found: ' + ${JSON.stringify(step.selector)});
              }
              
              if (element.type.toLowerCase() !== 'checkbox') {
                throw new Error('Element is not a checkbox: ' + ${JSON.stringify(step.selector)});
              }
              
              // Set the checked state
              element.checked = ${step.checked};
              
              // Dispatch change event
              element.dispatchEvent(new Event('change', { bubbles: true }));
              
              return true;
            } catch (error) {
              console.error('Error setting checkbox:', error);
              return false;
            }
          })()
        `);
        break;
        
      case 'radio':
        console.log(`Setting radio: ${JSON.stringify(step.selector)} to checked`);
        await webContents.executeJavaScript(`
          (function() {
            try {
              const element = document.querySelector(${JSON.stringify(step.selector)});
              if (!element) {
                throw new Error('Element not found: ' + ${JSON.stringify(step.selector)});
              }
              
              if (element.type.toLowerCase() !== 'radio') {
                throw new Error('Element is not a radio button: ' + ${JSON.stringify(step.selector)});
              }
              
              // Set the checked state
              element.checked = true;
              
              // Dispatch change event
              element.dispatchEvent(new Event('change', { bubbles: true }));
              
              return true;
            } catch (error) {
              console.error('Error setting radio button:', error);
              return false;
            }
          })()
        `);
        break;
        
      case 'wait':
        console.log(`Waiting for ${step.duration}ms`);
        await new Promise(resolve => setTimeout(resolve, step.duration));
        break;
        
      case 'waitForElement':
        console.log(`Waiting for element: ${JSON.stringify(step.selector)}`);
        await webContents.executeJavaScript(`
          (function() {
            return new Promise((resolve, reject) => {
              // Check if element already exists
              if (document.querySelector(${JSON.stringify(step.selector)})) {
                resolve(true);
                return;
              }
              
              // Set a timeout to avoid waiting forever
              const timeout = setTimeout(() => {
                observer.disconnect();
                reject(new Error('Timeout waiting for element: ' + ${JSON.stringify(step.selector)}));
              }, ${step.timeout || 10000});
              
              // Set up a mutation observer to watch for the element
              const observer = new MutationObserver((mutations, obs) => {
                if (document.querySelector(${JSON.stringify(step.selector)})) {
                  clearTimeout(timeout);
                  obs.disconnect();
                  resolve(true);
                }
              });
              
              observer.observe(document.body, {
                childList: true,
                subtree: true
              });
            });
          })()
        `).catch(error => {
          console.error('Error waiting for element:', error);
          return false;
        });
        break;
        
      case 'formFill':
        console.log(`Filling form with data: ${JSON.stringify(step.formData)}`);
        await webContents.executeJavaScript(`
          (function() {
            try {
              const formData = ${JSON.stringify(step.formData)};
              const results = [];
              
              // Process each form field
              for (const field of formData) {
                const element = document.querySelector(field.selector);
                if (!element) {
                  results.push({
                    selector: field.selector,
                    success: false,
                    error: 'Element not found'
                  });
                  continue;
                }
                
                try {
                  // Handle different input types
                  const tagName = element.tagName.toLowerCase();
                  const type = element.type ? element.type.toLowerCase() : '';
                  
                  if (tagName === 'input') {
                    if (type === 'checkbox' || type === 'radio') {
                      element.checked = field.value === true || field.value === 'true' || field.value === 1;
                    } else if (type === 'file') {
                      // File inputs can't be set directly via JavaScript for security reasons
                      results.push({
                        selector: field.selector,
                        success: false,
                        error: 'File inputs cannot be automated directly'
                      });
                      continue;
                    } else {
                      element.value = field.value;
                    }
                  } else if (tagName === 'select') {
                    element.value = field.value;
                  } else if (tagName === 'textarea') {
                    element.value = field.value;
                  } else {
                    results.push({
                      selector: field.selector,
                      success: false,
                      error: 'Unsupported element type: ' + tagName
                    });
                    continue;
                  }
                  
                  // Dispatch appropriate events
                  if (type === 'checkbox' || type === 'radio' || tagName === 'select') {
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                  } else {
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                  
                  results.push({
                    selector: field.selector,
                    success: true
                  });
                } catch (fieldError) {
                  results.push({
                    selector: field.selector,
                    success: false,
                    error: fieldError.message
                  });
                }
              }
              
              return results;
            } catch (error) {
              console.error('Error filling form:', error);
              return [{ success: false, error: error.message }];
            }
          })()
        `);
        break;
        
      default:
        console.error(`Unknown step type: ${step.type}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error executing workflow step:', error);
    return false;
  }
}

// Add event handlers for webContents
app.on('web-contents-created', (event, contents) => {
  if (contents.getType() === 'webview') {
    console.log('Webview created');
    
    // Handle navigation events
    contents.on('did-navigate', (event, url) => {
      console.log('Webview navigated to:', url);
      
      // Record navigation step if recording
      if (isRecording) {
        currentWorkflow.push({
          type: 'navigation',
          url
        });
      }
    });
    
    // Handle IPC messages from the webview
    contents.on('ipc-message', (event, channel, ...args) => {
      console.log('IPC message from webview:', channel, args);
      
      if (channel === 'link-clicked') {
        // No need to record this as it will trigger a navigation event
      } else if (channel === 'page-loaded') {
        // Record a wait step to ensure the page is loaded
        if (isRecording) {
          currentWorkflow.push({
            type: 'wait',
            duration: 1000 // Wait 1 second for page to stabilize
          });
        }
      } else if (channel === 'input-changed' && isRecording) {
        const data = args[0];
        console.log('Input changed:', data);
        
        // Record the appropriate step based on input type
        if (data.type === 'checkbox') {
          currentWorkflow.push({
            type: 'checkbox',
            selector: data.selector,
            checked: data.checked
          });
        } else if (data.type === 'radio') {
          currentWorkflow.push({
            type: 'radio',
            selector: data.selector
          });
        } else if (data.type === 'select') {
          currentWorkflow.push({
            type: 'select',
            selector: data.selector,
            value: data.value
          });
        } else {
          currentWorkflow.push({
            type: 'input',
            selector: data.selector,
            value: data.value
          });
        }
      } else if (channel === 'form-submitted' && isRecording) {
        const data = args[0];
        console.log('Form submitted:', data);
        
        // Record a formFill step with all form fields
        if (data.fields && data.fields.length > 0) {
          const formData = data.fields.map(field => ({
            selector: field.selector,
            value: field.value
          }));
          
          currentWorkflow.push({
            type: 'formFill',
            formSelector: data.formSelector,
            formData
          });
          
          // Add a click step to submit the form
          currentWorkflow.push({
            type: 'click',
            selector: `${data.formSelector} [type="submit"]`
          });
        }
      }
    });
  }
});