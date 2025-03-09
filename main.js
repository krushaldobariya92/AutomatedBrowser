const { app, BrowserWindow, session, Menu, ipcMain } = require('electron');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('node-fetch');
const path = require('path');

// Import our modules
const workflows = require('./src/main/workflows');

// Enable webview support
app.commandLine.appendSwitch('enable-features', 'WebViewTag');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

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
            win.webContents.executeJavaScript('window.workflows.show()');
          }
        },
        {
          label: 'Start Recording',
          click: async () => {
            const workflowName = `Workflow_${Date.now()}`;
            const result = await workflows.startRecording(workflowName);
            if (result.success) {
              win.webContents.executeJavaScript(`
                document.getElementById('workflow-status').textContent = 'Recording "${workflowName}"...';
                window.workflows.show();
              `);
            }
          }
        },
        {
          label: 'Stop Recording',
          click: async () => {
            const result = await workflows.stopRecording();
            if (result.success) {
              win.webContents.executeJavaScript(`
                document.getElementById('workflow-status').textContent = 'Saved workflow: ${result.workflow.name}';
                window.workflows.loadWorkflows();
              `);
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
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Load the renderer
  win.loadFile(path.join(__dirname, 'src/renderer/index.html'));
  
  // Open DevTools in development
  if (process.env.NODE_ENV !== 'production') {
    win.webContents.openDevTools();
  }
  
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