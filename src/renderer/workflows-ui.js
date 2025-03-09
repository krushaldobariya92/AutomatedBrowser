// workflows-ui.js - Manages the UI for workflow recording and playback
const { ipcRenderer } = require('electron');

// UI elements
let workflowPanelElement;
let workflowListElement;
let recordButton;
let stopButton;
let workflowNameInput;
let runButton;
let deleteButton;
let statusElement;

// State
let isRecording = false;
let isRunning = false;
let currentWorkflowId = null;
let recordedSteps = [];
let workflowList = {};

// Initialize the workflow UI
function initWorkflowUI() {
  createWorkflowPanel();
  loadWorkflows();
  setupEventListeners();
}

// Create workflow panel UI
function createWorkflowPanel() {
  // Create workflow panel if it doesn't exist
  if (!document.getElementById('workflow-panel')) {
    workflowPanelElement = document.createElement('div');
    workflowPanelElement.id = 'workflow-panel';
    workflowPanelElement.className = 'workflow-panel';
    workflowPanelElement.innerHTML = `
      <div class="workflow-header">
        <h3>Automated Workflows</h3>
        <button id="workflow-close" class="workflow-close-btn">×</button>
      </div>
      <div class="workflow-content">
        <div class="workflow-controls">
          <input type="text" id="workflow-name" placeholder="Workflow name" />
          <button id="workflow-record" class="workflow-btn record">Record</button>
          <button id="workflow-stop" class="workflow-btn stop" disabled>Stop</button>
        </div>
        <div class="workflow-status" id="workflow-status">Ready</div>
        <div class="workflow-list-header">
          <h4>Saved Workflows</h4>
          <div class="workflow-actions">
            <button id="workflow-run" class="workflow-btn run" disabled>Run</button>
            <button id="workflow-delete" class="workflow-btn delete" disabled>Delete</button>
          </div>
        </div>
        <div class="workflow-list" id="workflow-list">
          <div class="workflow-empty">No workflows yet. Record one to get started!</div>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .workflow-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        max-height: 500px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        z-index: 1000;
        overflow: hidden;
      }
      .workflow-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #1E3A8A;
        color: white;
      }
      .workflow-header h3 {
        margin: 0;
        font-size: 16px;
      }
      .workflow-close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
      }
      .workflow-content {
        padding: 16px;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .workflow-controls {
        display: flex;
        gap: 8px;
      }
      .workflow-controls input {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .workflow-btn {
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
      }
      .workflow-btn.record {
        background: #10B981;
        color: white;
      }
      .workflow-btn.stop {
        background: #EF4444;
        color: white;
      }
      .workflow-btn.run {
        background: #3B82F6;
        color: white;
      }
      .workflow-btn.delete {
        background: #6B7280;
        color: white;
      }
      .workflow-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .workflow-status {
        padding: 8px;
        background: #f8f9fa;
        border-radius: 4px;
        font-size: 14px;
      }
      .workflow-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .workflow-list-header h4 {
        margin: 0;
        font-size: 14px;
      }
      .workflow-actions {
        display: flex;
        gap: 8px;
      }
      .workflow-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 200px;
        overflow-y: auto;
      }
      .workflow-item {
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
      }
      .workflow-item.selected {
        border-color: #3B82F6;
        background: rgba(59, 130, 246, 0.1);
      }
      .workflow-item-header {
        display: flex;
        justify-content: space-between;
        font-weight: 500;
      }
      .workflow-item-details {
        font-size: 12px;
        color: #6B7280;
        margin-top: 4px;
      }
      .workflow-empty {
        text-align: center;
        color: #6B7280;
        font-size: 14px;
        padding: 20px 0;
      }
      .workflow-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
      }
    `;
    
    document.head.appendChild(style);
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'workflow-overlay';
    overlay.id = 'workflow-overlay';
    
    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(workflowPanelElement);
    
    // Get UI elements
    workflowListElement = document.getElementById('workflow-list');
    recordButton = document.getElementById('workflow-record');
    stopButton = document.getElementById('workflow-stop');
    workflowNameInput = document.getElementById('workflow-name');
    runButton = document.getElementById('workflow-run');
    deleteButton = document.getElementById('workflow-delete');
    statusElement = document.getElementById('workflow-status');
    
    // Add close handler
    document.getElementById('workflow-close').addEventListener('click', hideWorkflowPanel);
    document.getElementById('workflow-overlay').addEventListener('click', hideWorkflowPanel);
  }
}

// Show the workflow panel
function showWorkflowPanel() {
  document.getElementById('workflow-panel').style.display = 'flex';
  document.getElementById('workflow-overlay').style.display = 'block';
  loadWorkflows();
}

// Hide the workflow panel
function hideWorkflowPanel() {
  document.getElementById('workflow-panel').style.display = 'none';
  document.getElementById('workflow-overlay').style.display = 'none';
}

// Set up event listeners for the UI
function setupEventListeners() {
  // Record button
  recordButton.addEventListener('click', async () => {
    const name = workflowNameInput.value.trim() || `Workflow ${new Date().toLocaleString()}`;
    
    const result = await ipcRenderer.invoke('workflow:startRecording', name);
    
    if (result.success) {
      isRecording = true;
      recordButton.disabled = true;
      stopButton.disabled = false;
      runButton.disabled = true;
      deleteButton.disabled = true;
      
      // Clear previous steps
      recordedSteps = [];
      
      updateStatus(`Recording "${name}"...`);
      
      // Start capturing user actions
      startCapturingActions();
    } else {
      updateStatus(result.message);
    }
  });
  
  // Stop button
  stopButton.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('workflow:stopRecording');
    
    if (result.success) {
      isRecording = false;
      recordButton.disabled = false;
      stopButton.disabled = true;
      
      updateStatus(`Saved workflow: ${result.workflow.name}`);
      
      // Stop capturing actions
      stopCapturingActions();
      
      // Clear name input
      workflowNameInput.value = '';
      
      // Reload workflows
      loadWorkflows();
    } else {
      updateStatus(result.message);
    }
  });
  
  // Run button
  runButton.addEventListener('click', async () => {
    const selectedItem = document.querySelector('.workflow-item.selected');
    if (!selectedItem) return;
    
    const workflowName = selectedItem.dataset.name;
    const result = await ipcRenderer.invoke('workflow:runWorkflow', workflowName);
    
    if (result.success) {
      isRunning = true;
      currentWorkflowId = result.workflowId;
      
      recordButton.disabled = true;
      runButton.disabled = true;
      deleteButton.disabled = true;
      
      updateStatus(`Running workflow: ${workflowName}`);
      
      // Start executing the workflow
      executeWorkflow(result.workflowId);
    } else {
      updateStatus(result.message);
    }
  });
  
  // Delete button
  deleteButton.addEventListener('click', async () => {
    const selectedItem = document.querySelector('.workflow-item.selected');
    if (!selectedItem) return;
    
    const workflowName = selectedItem.dataset.name;
    
    if (confirm(`Are you sure you want to delete the workflow "${workflowName}"?`)) {
      const result = await ipcRenderer.invoke('workflow:deleteWorkflow', workflowName);
      
      if (result.success) {
        updateStatus(result.message);
        loadWorkflows();
      } else {
        updateStatus(result.message);
      }
    }
  });
}

// Load and display saved workflows
async function loadWorkflows() {
  workflowList = await ipcRenderer.invoke('workflow:getWorkflows');
  
  // Clear workflow list
  workflowListElement.innerHTML = '';
  
  if (Object.keys(workflowList).length === 0) {
    workflowListElement.innerHTML = '<div class="workflow-empty">No workflows yet. Record one to get started!</div>';
    runButton.disabled = true;
    deleteButton.disabled = true;
    return;
  }
  
  // Add workflow items
  for (const [name, workflow] of Object.entries(workflowList)) {
    const item = document.createElement('div');
    item.className = 'workflow-item';
    item.dataset.name = name;
    item.dataset.id = workflow.id;
    
    const createdDate = new Date(workflow.createdAt).toLocaleDateString();
    const lastRunDate = workflow.lastRun ? new Date(workflow.lastRun).toLocaleDateString() : 'Never';
    
    item.innerHTML = `
      <div class="workflow-item-header">
        <span>${name}</span>
        <span>${workflow.steps.length} steps</span>
      </div>
      <div class="workflow-item-details">
        Created: ${createdDate} | Last run: ${lastRunDate}
      </div>
    `;
    
    item.addEventListener('click', () => {
      // Deselect all items
      document.querySelectorAll('.workflow-item').forEach(el => {
        el.classList.remove('selected');
      });
      
      // Select this item
      item.classList.add('selected');
      
      // Enable run and delete buttons
      runButton.disabled = false;
      deleteButton.disabled = false;
    });
    
    workflowListElement.appendChild(item);
  }
}

// Start capturing user actions for recording
function startCapturingActions() {
  const webview = document.getElementById('webview');
  
  // Capture navigation
  webview.addEventListener('did-navigate', handleNavigation);
  webview.addEventListener('did-navigate-in-page', handleNavigationInPage);
  
  // Inject script to capture clicks, form inputs, etc.
  webview.executeJavaScript(`
    // Record clicks
    document.addEventListener('click', event => {
      const target = event.target;
      const path = getElementPath(target);
      
      // Only record relevant clicks (links, buttons, etc.)
      if (target.tagName === 'A' || target.tagName === 'BUTTON' ||
          target.type === 'submit' || target.type === 'checkbox' ||
          target.type === 'radio') {
        window.postMessage({
          type: 'workflow:action',
          action: {
            type: 'click',
            path: path,
            tagName: target.tagName,
            innerText: target.innerText,
            href: target.href || null,
            id: target.id || null,
            url: window.location.href
          }
        }, '*');
      }
    });
    
    // Record form inputs
    document.addEventListener('input', event => {
      const target = event.target;
      const path = getElementPath(target);
      
      // Only record relevant inputs
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        window.postMessage({
          type: 'workflow:action',
          action: {
            type: 'input',
            path: path,
            tagName: target.tagName,
            inputType: target.type || null,
            value: target.value,
            id: target.id || null,
            name: target.name || null,
            url: window.location.href
          }
        }, '*');
      }
    });
    
    // Record form submissions
    document.addEventListener('submit', event => {
      const target = event.target;
      const path = getElementPath(target);
      
      window.postMessage({
        type: 'workflow:action',
        action: {
          type: 'submit',
          path: path,
          action: target.action || null,
          method: target.method || null,
          url: window.location.href
        }
      }, '*');
    });
    
    // Helper function to get CSS selector path to element
    function getElementPath(element) {
      if (!element || element === document || element === document.documentElement) {
        return '';
      }
      
      let path = '';
      
      while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        
        if (element.id) {
          selector += '#' + element.id;
          return selector + path;
        } else {
          let sibling = element;
          let siblingCount = 1;
          
          while (sibling = sibling.previousElementSibling) {
            if (sibling.nodeName.toLowerCase() === selector) {
              siblingCount++;
            }
          }
          
          if (element.previousElementSibling || element.nextElementSibling) {
            selector += ':nth-child(' + siblingCount + ')';
          }
        }
        
        path = ' > ' + selector + path;
        
        element = element.parentNode;
      }
      
      return path.substr(3); // Remove the first ' > '
    }
  `);
  
  // Listen for messages from the webview
  webview.addEventListener('ipc-message', handleWebviewMessage);
}

// Stop capturing user actions
function stopCapturingActions() {
  const webview = document.getElementById('webview');
  
  // Remove event listeners
  webview.removeEventListener('did-navigate', handleNavigation);
  webview.removeEventListener('did-navigate-in-page', handleNavigationInPage);
  webview.removeEventListener('ipc-message', handleWebviewMessage);
  
  // Clear injected scripts
  webview.executeJavaScript(`
    document.removeEventListener('click', window.workflowClickHandler);
    document.removeEventListener('input', window.workflowInputHandler);
    document.removeEventListener('submit', window.workflowSubmitHandler);
  `);
}

// Handle navigation events
async function handleNavigation(event) {
  if (!isRecording) return;
  
  const step = {
    type: 'navigation',
    url: event.url,
    action: 'navigate'
  };
  
  await recordWorkflowStep(step);
}

// Handle in-page navigation events
async function handleNavigationInPage(event) {
  if (!isRecording) return;
  
  const step = {
    type: 'navigation',
    url: event.url,
    action: 'navigate-in-page'
  };
  
  await recordWorkflowStep(step);
}

// Handle messages from the webview
async function handleWebviewMessage(event) {
  if (!isRecording) return;
  
  if (event.channel === 'workflow:action') {
    const action = event.args[0];
    await recordWorkflowStep(action);
  }
}

// Record a step in the current workflow
async function recordWorkflowStep(step) {
  const result = await ipcRenderer.invoke('workflow:recordStep', step);
  
  if (result.success) {
    recordedSteps.push(step);
    updateStatus(`Recorded step: ${step.type}`);
  }
}

// Execute a workflow
async function executeWorkflow(workflowId) {
  let isComplete = false;
  
  while (!isComplete) {
    const result = await ipcRenderer.invoke('workflow:getNextStep', workflowId);
    
    if (!result.success) {
      updateStatus(`Error: ${result.message}`);
      break;
    }
    
    isComplete = result.complete;
    
    if (isComplete) {
      updateStatus('Workflow completed successfully!');
      isRunning = false;
      currentWorkflowId = null;
      
      recordButton.disabled = false;
      runButton.disabled = false;
      deleteButton.disabled = false;
      
      break;
    }
    
    updateStatus(`Running step ${result.currentStep}/${result.totalSteps}: ${result.step.type}`);
    
    // Execute the step
    await executeWorkflowStep(result.step);
    
    // Small delay between steps for stability
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Execute a single workflow step
async function executeWorkflowStep(step) {
  const webview = document.getElementById('webview');
  
  switch (step.type) {
    case 'navigation':
      webview.src = step.url;
      break;
      
    case 'click':
      await webview.executeJavaScript(`
        (function() {
          try {
            const element = document.querySelector('${step.path}');
            if (element) {
              element.click();
              return true;
            }
            return false;
          } catch (error) {
            console.error('Error executing click:', error);
            return false;
          }
        })()
      `);
      break;
      
    case 'input':
      await webview.executeJavaScript(`
        (function() {
          try {
            const element = document.querySelector('${step.path}');
            if (element) {
              element.value = ${JSON.stringify(step.value)};
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          } catch (error) {
            console.error('Error executing input:', error);
            return false;
          }
        })()
      `);
      break;
      
    case 'submit':
      await webview.executeJavaScript(`
        (function() {
          try {
            const form = document.querySelector('${step.path}');
            if (form) {
              form.submit();
              return true;
            }
            return false;
          } catch (error) {
            console.error('Error executing submit:', error);
            return false;
          }
        })()
      `);
      break;
      
    default:
      console.warn('Unknown step type:', step.type);
      break;
  }
}

// Update the status message
function updateStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

// Export functions
window.workflows = {
  show: showWorkflowPanel,
  hide: hideWorkflowPanel,
  init: initWorkflowUI
};

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', initWorkflowUI); 