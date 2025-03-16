const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    ipcRenderer: {
      invoke: (channel, ...args) => {
        return ipcRenderer.invoke(channel, ...args);
      },
      send: (channel, ...args) => {
        ipcRenderer.send(channel, ...args);
      },
      on: (channel, func) => {
        // Strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      },
      once: (channel, func) => {
        ipcRenderer.once(channel, (event, ...args) => func(...args));
      },
      removeListener: (channel, func) => {
        ipcRenderer.removeListener(channel, func);
      }
    }
  }
);

console.log('Main window preload script loaded'); 