const { app, BrowserWindow, session, Menu, ipcMain } = require('electron');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// Import our modules
console.log('Checking for workflows.js file...');
const workflowsPath = path.join(__dirname, 'src', 'main', 'workflows.js');
if (fs.existsSync(workflowsPath)) {
  console.log('Workflows module found at:', workflowsPath);
} else {
  console.error('Workflows module not found at:', workflowsPath);
}

try {
  const workflows = require('./src/main/workflows');
  console.log('Workflows module imported successfully');
} catch (error) {
  console.error('Error importing workflows module:', error);
}

// Enable webview support
app.commandLine.appendSwitch('enable-features', 'WebViewTag');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Initialize workflows directly to avoid module loading issues
const workflows = {
  initialize: () => {
    console.log('Initializing workflows directly');
    
    // Path to store workflows
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
    
    // Set up IPC handlers
    ipcMain.handle('workflow:startRecording', (event, name) => {
      console.log('IPC: Start recording workflow', name);
      if (isRecording) {
        return { success: false, message: 'Already recording a workflow' };
      }
      
      workflowName = name || `Workflow_${Date.now()}`;
      currentWorkflow = [];
      isRecording = true;
      
      return { success: true, message: `Started recording workflow: ${workflowName}` };
    });
    
    ipcMain.handle('workflow:stopRecording', () => {
      console.log('IPC: Stop recording workflow');
      if (!isRecording) {
        return { success: false, message: 'No active recording' };
      }
      
      isRecording = false;
      
      // Don't save empty workflows
      if (currentWorkflow.length === 0) {
        return { success: false, message: 'Workflow is empty, nothing to save' };
      }
      
      // Save the workflow
      const workflowsFile = path.join(workflowsDir, 'workflows.json');
      let workflows = {};
      
      try {
        if (fs.existsSync(workflowsFile)) {
          workflows = JSON.parse(fs.readFileSync(workflowsFile, 'utf8'));
        }
      } catch (error) {
        console.error('Error loading workflows:', error);
      }
      
      workflows[workflowName] = {
        id: Math.random().toString(36).substr(2, 9),
        name: workflowName,
        steps: currentWorkflow,
        createdAt: Date.now(),
        lastRun: null
      };
      
      try {
        fs.writeFileSync(workflowsFile, JSON.stringify(workflows, null, 2), 'utf8');
        console.log('Saved workflow:', workflowName);
      } catch (error) {
        console.error('Error saving workflow:', error);
        return { success: false, message: `Error saving workflow: ${error.message}` };
      }
      
      return { 
        success: true, 
        message: `Saved workflow: ${workflowName}`,
        workflow: workflows[workflowName]
      };
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
      const workflowsFile = path.join(workflowsDir, 'workflows.json');
      
      try {
        if (fs.existsSync(workflowsFile)) {
          return JSON.parse(fs.readFileSync(workflowsFile, 'utf8'));
        }
      } catch (error) {
        console.error('Error loading workflows:', error);
      }
      
      return {};
    });
    
    ipcMain.handle('workflow:runWorkflow', (event, name) => {
      console.log('IPC: Run workflow', name);
      const workflowsFile = path.join(workflowsDir, 'workflows.json');
      let workflows = {};
      
      try {
        if (fs.existsSync(workflowsFile)) {
          workflows = JSON.parse(fs.readFileSync(workflowsFile, 'utf8'));
        }
      } catch (error) {
        console.error('Error loading workflows:', error);
        return { success: false, message: 'Error loading workflows' };
      }
      
      if (!workflows[name]) {
        return { success: false, message: `Workflow not found: ${name}` };
      }
      
      const workflow = workflows[name];
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
      workflows[name].lastRun = Date.now();
      try {
        fs.writeFileSync(workflowsFile, JSON.stringify(workflows, null, 2), 'utf8');
      } catch (error) {
        console.error('Error updating workflow last run time:', error);
      }
      
      return { 
        success: true, 
        message: `Started workflow: ${name}`,
        workflowId
      };
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
      const workflowsFile = path.join(workflowsDir, 'workflows.json');
      let workflows = {};
      
      try {
        if (fs.existsSync(workflowsFile)) {
          workflows = JSON.parse(fs.readFileSync(workflowsFile, 'utf8'));
        }
      } catch (error) {
        console.error('Error loading workflows:', error);
        return { success: false, message: 'Error loading workflows' };
      }
      
      if (!workflows[name]) {
        return { success: false, message: `Workflow not found: ${name}` };
      }
      
      delete workflows[name];
      
      try {
        fs.writeFileSync(workflowsFile, JSON.stringify(workflows, null, 2), 'utf8');
      } catch (error) {
        console.error('Error saving workflows after delete:', error);
        return { success: false, message: `Error deleting workflow: ${error.message}` };
      }
      
      return { success: true, message: `Deleted workflow: ${name}` };
    });
    
    console.log('Workflow system initialized');
  }
};

app.on('ready', async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { 
      nodeIntegration: true, 
      contextIsolation: false,
      webviewTag: true, // Enable webview tag
      webSecurity: false, // Disable web security for development
      allowRunningInsecureContent: true, // Allow running insecure content
      enableRemoteModule: true // Enable remote module for webview
    }
  });

  // Initialize our modules
  console.log('Initializing workflows module...');
  workflows.initialize();

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

  // Create application menu with workflow options
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Workflows',
      submenu: [
        {
          label: 'Manage Workflows',
          click: () => {
            console.log('Menu: Manage Workflows clicked');
            win.webContents.executeJavaScript('if (window.workflows) window.workflows.show(); else console.error("Workflows object not found");');
          }
        },
        {
          label: 'Start Recording',
          click: async () => {
            console.log('Menu: Start Recording clicked');
            const workflowName = `Workflow_${Date.now()}`;
            
            try {
              const result = await ipcMain.emit('workflow:startRecording', null, workflowName);
              console.log('Start recording result:', result);
              win.webContents.executeJavaScript(`
                if (window.workflows) {
                  document.getElementById('workflow-status').textContent = 'Recording "${workflowName}"...';
                  window.workflows.show();
                } else {
                  console.error("Workflows object not found");
                }
              `);
            } catch (error) {
              console.error('Error starting recording from menu:', error);
            }
          }
        },
        {
          label: 'Stop Recording',
          click: async () => {
            console.log('Menu: Stop Recording clicked');
            try {
              const result = await ipcMain.emit('workflow:stopRecording');
              console.log('Stop recording result:', result);
              win.webContents.executeJavaScript(`
                if (window.workflows) {
                  window.workflows.loadWorkflows();
                } else {
                  console.error("Workflows object not found");
                }
              `);
            } catch (error) {
              console.error('Error stopping recording from menu:', error);
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About AutomatedBrowser',
          click: () => {
            const aboutWindow = new BrowserWindow({
              width: 300,
              height: 200,
              autoHideMenuBar: true,
              resizable: false,
              webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
              }
            });
            
            aboutWindow.loadURL(`data:text/html;charset=utf-8,
              <html>
                <head>
                  <title>About AutomatedBrowser</title>
                  <style>
                    body { font-family: Arial; padding: 20px; text-align: center; }
                    h2 { margin-top: 0; }
                  </style>
                </head>
                <body>
                  <h2>AutomatedBrowser</h2>
                  <p>Version 1.0.0</p>
                  <p>An automation-focused browser with workflow recording capabilities</p>
                </body>
              </html>
            `);
          }
        },
        {
          label: 'Toggle Developer Tools',
          click: () => {
            win.webContents.toggleDevTools();
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Load the renderer
  win.loadFile(path.join(__dirname, 'src/renderer/index.html'));
  
  // Open DevTools in development
  win.webContents.openDevTools();
  
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