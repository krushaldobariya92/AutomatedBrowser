const { app, BrowserWindow, session } = require('electron');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('node-fetch');
const path = require('path');

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