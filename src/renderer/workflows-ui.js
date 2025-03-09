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
  console.log('Initializing workflow UI...');
  createWorkflowPanel();
  setupEventListeners();
  
  // Initially hide the panel
  const panel = document.getElementById('workflow-panel');
  const overlay = document.getElementById('workflow-overlay');
  if (panel) panel.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  
  // Add workflow button if not already present
  const urlBarContainer = document.querySelector('.url-bar-container');
  if (urlBarContainer && !document.getElementById('workflow-btn')) {
    const workflowBtn = document.createElement('button');
    workflowBtn.id = 'workflow-btn';
    workflowBtn.title = 'Manage Workflows';
    workflowBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6 2a.5.5 0 0 1 .47.33L10 12.036l1.53-4.208A.5.5 0 0 1 12 7.5h3.5a.5.5 0 0 1 0 1h-3.15l-1.88 5.17a.5.5 0 0 1-.94 0L6 3.964 4.47 8.172A.5.5 0 0 1 4 8.5H.5a.5.5 0 0 1 0-1h3.15l1.88-5.17A.5.5 0 0 1 6 2Z"/></svg>';
    workflowBtn.style.cssText = 'background: #1E3A8A; color: white; border: none; border-radius: 4px; padding: 8px 12px; margin-left: 5px; cursor: pointer;';
    workflowBtn.addEventListener('click', showWorkflowPanel);
    urlBarContainer.appendChild(workflowBtn);
  }
  
  console.log('Workflow UI initialized:', {
    panel: !!panel, 
    overlay: !!overlay, 
    button: !!document.getElementById('workflow-btn')
  });
}

// Create workflow panel UI
function createWorkflowPanel() {
  console.log('Creating workflow panel...');
  
  // Remove existing panel if it exists
  const existingPanel = document.getElementById('workflow-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  const existingOverlay = document.getElementById('workflow-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'workflow-overlay';
  overlay.id = 'workflow-overlay';
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
  
  // Create workflow panel
  workflowPanelElement = document.createElement('div');
  workflowPanelElement.id = 'workflow-panel';
  workflowPanelElement.className = 'workflow-panel';
  workflowPanelElement.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    max-height: 500px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: none;
    flex-direction: column;
    z-index: 1000;
    overflow: hidden;
  `;
  
  workflowPanelElement.innerHTML = `
    <div class="workflow-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #1E3A8A; color: white;">
      <h3 style="margin: 0; font-size: 16px;">Automated Workflows</h3>
      <button id="workflow-close" class="workflow-close-btn" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">×</button>
    </div>
    <div class="workflow-content" style="padding: 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px;">
      <div class="workflow-controls" style="display: flex; gap: 8px;">
        <input type="text" id="workflow-name" placeholder="Workflow name" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <button id="workflow-record" class="workflow-btn record" style="padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; background: #10B981; color: white;">Record</button>
        <button id="workflow-stop" class="workflow-btn stop" style="padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; background: #EF4444; color: white; opacity: 0.5; cursor: not-allowed;" disabled>Stop</button>
      </div>
      <div class="workflow-status" id="workflow-status" style="padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 14px;">Ready</div>
      <div class="workflow-list-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin: 0; font-size: 14px;">Saved Workflows</h4>
        <div class="workflow-actions" style="display: flex; gap: 8px;">
          <button id="workflow-run" class="workflow-btn run" style="padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; background: #3B82F6; color: white; opacity: 0.5; cursor: not-allowed;" disabled>Run</button>
          <button id="workflow-delete" class="workflow-btn delete" style="padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; background: #6B7280; color: white; opacity: 0.5; cursor: not-allowed;" disabled>Delete</button>
        </div>
      </div>
      <div class="workflow-list" id="workflow-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
        <div class="workflow-empty" style="text-align: center; color: #6B7280; font-size: 14px; padding: 20px 0;">No workflows yet. Record one to get started!</div>
      </div>
    </div>
  `;
  
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
  
  console.log('Workflow panel created with elements:', {
    list: !!workflowListElement,
    record: !!recordButton,
    stop: !!stopButton,
    name: !!workflowNameInput,
    run: !!runButton,
    delete: !!deleteButton,
    status: !!statusElement
  });
}

// Show the workflow panel
function showWorkflowPanel() {
  console.log('Showing workflow panel');
  const panel = document.getElementById('workflow-panel');
  const overlay = document.getElementById('workflow-overlay');
  
  if (panel) panel.style.display = 'flex';
  if (overlay) overlay.style.display = 'block';
  
  loadWorkflows();
}

// Hide the workflow panel
function hideWorkflowPanel() {
  console.log('Hiding workflow panel');
  const panel = document.getElementById('workflow-panel');
  const overlay = document.getElementById('workflow-overlay');
  
  if (panel) panel.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
}

// Set up event listeners for the UI
function setupEventListeners() {
  console.log('Setting up event listeners');
  
  if (!recordButton || !stopButton || !runButton || !deleteButton) {
    console.error('Required UI elements not found for event listeners');
    return;
  }
  
  // Record button
  recordButton.addEventListener('click', async () => {
    const name = workflowNameInput.value.trim() || `Workflow ${new Date().toLocaleString()}`;
    console.log('Record button clicked, name:', name);
    
    try {
      const result = await ipcRenderer.invoke('workflow:startRecording', name);
      console.log('Start recording result:', result);
      
      if (result.success) {
        isRecording = true;
        recordButton.disabled = true;
        stopButton.disabled = false;
        runButton.disabled = true;
        deleteButton.disabled = true;
        
        // Update styles
        recordButton.style.opacity = '0.5';
        recordButton.style.cursor = 'not-allowed';
        stopButton.style.opacity = '1';
        stopButton.style.cursor = 'pointer';
        
        // Clear previous steps
        recordedSteps = [];
        
        updateStatus(`Recording "${name}"...`);
        
        // Start capturing user actions
        startCapturingActions();
      } else {
        updateStatus(result.message);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      updateStatus('Error starting recording');
    }
  });
  
  // Stop button
  stopButton.addEventListener('click', async () => {
    console.log('Stop button clicked');
    
    try {
      const result = await ipcRenderer.invoke('workflow:stopRecording');
      console.log('Stop recording result:', result);
      
      if (result.success) {
        isRecording = false;
        recordButton.disabled = false;
        stopButton.disabled = true;
        
        // Update styles
        recordButton.style.opacity = '1';
        recordButton.style.cursor = 'pointer';
        stopButton.style.opacity = '0.5';
        stopButton.style.cursor = 'not-allowed';
        
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
    } catch (error) {
      console.error('Error stopping recording:', error);
      updateStatus('Error stopping recording');
    }
  });
  
  // Run button
  runButton.addEventListener('click', async () => {
    const selectedItem = document.querySelector('.workflow-item.selected');
    if (!selectedItem) return;
    
    const workflowName = selectedItem.dataset.name;
    console.log('Run button clicked for workflow:', workflowName);
    
    try {
      const result = await ipcRenderer.invoke('workflow:runWorkflow', workflowName);
      console.log('Run workflow result:', result);
      
      if (result.success) {
        isRunning = true;
        currentWorkflowId = result.workflowId;
        
        recordButton.disabled = true;
        runButton.disabled = true;
        deleteButton.disabled = true;
        
        // Update styles
        recordButton.style.opacity = '0.5';
        recordButton.style.cursor = 'not-allowed';
        runButton.style.opacity = '0.5';
        runButton.style.cursor = 'not-allowed';
        deleteButton.style.opacity = '0.5';
        deleteButton.style.cursor = 'not-allowed';
        
        updateStatus(`Running workflow: ${workflowName}`);
        
        // Start executing the workflow
        executeWorkflow(result.workflowId);
      } else {
        updateStatus(result.message);
      }
    } catch (error) {
      console.error('Error running workflow:', error);
      updateStatus('Error running workflow');
    }
  });
  
  // Delete button
  deleteButton.addEventListener('click', async () => {
    const selectedItem = document.querySelector('.workflow-item.selected');
    if (!selectedItem) return;
    
    const workflowName = selectedItem.dataset.name;
    console.log('Delete button clicked for workflow:', workflowName);
    
    if (confirm(`Are you sure you want to delete the workflow "${workflowName}"?`)) {
      try {
        const result = await ipcRenderer.invoke('workflow:deleteWorkflow', workflowName);
        console.log('Delete workflow result:', result);
        
        if (result.success) {
          updateStatus(result.message);
          loadWorkflows();
        } else {
          updateStatus(result.message);
        }
      } catch (error) {
        console.error('Error deleting workflow:', error);
        updateStatus('Error deleting workflow');
      }
    }
  });
}

// Load and display saved workflows
async function loadWorkflows() {
  console.log('Loading workflows...');
  
  if (!workflowListElement) {
    console.error('Workflow list element not found');
    return;
  }
  
  try {
    workflowList = await ipcRenderer.invoke('workflow:getWorkflows');
    console.log('Loaded workflows:', workflowList);
    
    // Clear workflow list
    workflowListElement.innerHTML = '';
    
    if (Object.keys(workflowList).length === 0) {
      workflowListElement.innerHTML = '<div class="workflow-empty" style="text-align: center; color: #6B7280; font-size: 14px; padding: 20px 0;">No workflows yet. Record one to get started!</div>';
      
      if (runButton) {
        runButton.disabled = true;
        runButton.style.opacity = '0.5';
        runButton.style.cursor = 'not-allowed';
      }
      
      if (deleteButton) {
        deleteButton.disabled = true;
        deleteButton.style.opacity = '0.5';
        deleteButton.style.cursor = 'not-allowed';
      }
      
      return;
    }
    
    // Add workflow items
    for (const [name, workflow] of Object.entries(workflowList)) {
      const item = document.createElement('div');
      item.className = 'workflow-item';
      item.dataset.name = name;
      item.dataset.id = workflow.id;
      item.style.cssText = 'padding: 10px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;';
      
      const createdDate = new Date(workflow.createdAt).toLocaleDateString();
      const lastRunDate = workflow.lastRun ? new Date(workflow.lastRun).toLocaleDateString() : 'Never';
      
      item.innerHTML = `
        <div class="workflow-item-header" style="display: flex; justify-content: space-between; font-weight: 500;">
          <span>${name}</span>
          <span>${workflow.steps.length} steps</span>
        </div>
        <div class="workflow-item-details" style="font-size: 12px; color: #6B7280; margin-top: 4px;">
          Created: ${createdDate} | Last run: ${lastRunDate}
        </div>
      `;
      
      item.addEventListener('click', () => {
        // Deselect all items
        document.querySelectorAll('.workflow-item').forEach(el => {
          el.classList.remove('selected');
          el.style.borderColor = '#ddd';
          el.style.background = 'none';
        });
        
        // Select this item
        item.classList.add('selected');
        item.style.borderColor = '#3B82F6';
        item.style.background = 'rgba(59, 130, 246, 0.1)';
        
        // Enable run and delete buttons
        if (runButton) {
          runButton.disabled = false;
          runButton.style.opacity = '1';
          runButton.style.cursor = 'pointer';
        }
        
        if (deleteButton) {
          deleteButton.disabled = false;
          deleteButton.style.opacity = '1';
          deleteButton.style.cursor = 'pointer';
        }
      });
      
      workflowListElement.appendChild(item);
    }
  } catch (error) {
    console.error('Error loading workflows:', error);
    updateStatus('Error loading workflows');
  }
}

// Start capturing user actions for recording
function startCapturingActions() {
  console.log('Start capturing actions');
  const webview = document.getElementById('webview');
  
  if (!webview) {
    console.error('Webview not found for capturing actions');
    return;
  }
  
  // Capture navigation
  webview.addEventListener('did-navigate', handleNavigation);
  webview.addEventListener('did-navigate-in-page', handleNavigationInPage);
  
  // Inject script to capture clicks, form inputs, etc.
  webview.executeJavaScript(`
    console.log('Injecting action capture script');
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
    console.log('Action capture script injected');
  `);
  
  // Listen for messages from the webview
  webview.addEventListener('ipc-message', handleWebviewMessage);
  
  // Also listen for console messages
  webview.addEventListener('console-message', (e) => {
    console.log('Webview console:', e.message);
  });
}

// Stop capturing user actions
function stopCapturingActions() {
  console.log('Stop capturing actions');
  const webview = document.getElementById('webview');
  
  if (!webview) {
    console.error('Webview not found for stopping capture');
    return;
  }
  
  // Remove event listeners
  webview.removeEventListener('did-navigate', handleNavigation);
  webview.removeEventListener('did-navigate-in-page', handleNavigationInPage);
  webview.removeEventListener('ipc-message', handleWebviewMessage);
  
  // Clear injected scripts
  webview.executeJavaScript(`
    document.removeEventListener('click', window.workflowClickHandler);
    document.removeEventListener('input', window.workflowInputHandler);
    document.removeEventListener('submit', window.workflowSubmitHandler);
    console.log('Action capture script removed');
  `);
}

// Handle navigation events
async function handleNavigation(event) {
  console.log('Navigation event:', event.url);
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
  console.log('In-page navigation event:', event.url);
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
  console.log('Webview message:', event.channel, event.args);
  if (!isRecording) return;
  
  if (event.channel === 'workflow:action') {
    const action = event.args[0];
    await recordWorkflowStep(action);
  }
}

// Record a step in the current workflow
async function recordWorkflowStep(step) {
  console.log('Recording step:', step);
  
  try {
    const result = await ipcRenderer.invoke('workflow:recordStep', step);
    console.log('Record step result:', result);
    
    if (result.success) {
      recordedSteps.push(step);
      updateStatus(`Recorded step: ${step.type}`);
    } else {
      updateStatus(`Failed to record step: ${result.message}`);
    }
  } catch (error) {
    console.error('Error recording step:', error);
    updateStatus('Error recording step');
  }
}

// Execute a workflow
async function executeWorkflow(workflowId) {
  console.log('Executing workflow:', workflowId);
  let isComplete = false;
  
  try {
    while (!isComplete) {
      const result = await ipcRenderer.invoke('workflow:getNextStep', workflowId);
      console.log('Next step result:', result);
      
      if (!result.success) {
        updateStatus(`Error: ${result.message}`);
        break;
      }
      
      isComplete = result.complete;
      
      if (isComplete) {
        updateStatus('Workflow completed successfully!');
        isRunning = false;
        currentWorkflowId = null;
        
        if (recordButton) {
          recordButton.disabled = false;
          recordButton.style.opacity = '1';
          recordButton.style.cursor = 'pointer';
        }
        
        if (runButton) {
          runButton.disabled = false;
          runButton.style.opacity = '1';
          runButton.style.cursor = 'pointer';
        }
        
        if (deleteButton) {
          deleteButton.disabled = false;
          deleteButton.style.opacity = '1';
          deleteButton.style.cursor = 'pointer';
        }
        
        break;
      }
      
      updateStatus(`Running step ${result.currentStep}/${result.totalSteps}: ${result.step.type}`);
      
      // Execute the step
      await executeWorkflowStep(result.step);
      
      // Small delay between steps for stability
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error('Error executing workflow:', error);
    updateStatus('Error executing workflow');
    
    isRunning = false;
    currentWorkflowId = null;
    
    if (recordButton) {
      recordButton.disabled = false;
      recordButton.style.opacity = '1';
      recordButton.style.cursor = 'pointer';
    }
    
    if (runButton) {
      runButton.disabled = false;
      runButton.style.opacity = '1';
      runButton.style.cursor = 'pointer';
    }
    
    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.style.opacity = '1';
      deleteButton.style.cursor = 'pointer';
    }
  }
}

// Execute a single workflow step
async function executeWorkflowStep(step) {
  console.log('Executing step:', step);
  const webview = document.getElementById('webview');
  
  if (!webview) {
    console.error('Webview not found for executing step');
    throw new Error('Webview not found');
  }
  
  switch (step.type) {
    case 'navigation':
      console.log('Navigating to:', step.url);
      webview.src = step.url;
      break;
      
    case 'click':
      console.log('Clicking element:', step.path);
      const clickResult = await webview.executeJavaScript(`
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
      console.log('Click result:', clickResult);
      break;
      
    case 'input':
      console.log('Setting input value:', step.path, step.value);
      const inputResult = await webview.executeJavaScript(`
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
      console.log('Input result:', inputResult);
      break;
      
    case 'submit':
      console.log('Submitting form:', step.path);
      const submitResult = await webview.executeJavaScript(`
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
      console.log('Submit result:', submitResult);
      break;
      
    default:
      console.warn('Unknown step type:', step.type);
      break;
  }
}

// Update the status message
function updateStatus(message) {
  console.log('Status update:', message);
  if (statusElement) {
    statusElement.textContent = message;
  }
}

// Export functions
window.workflows = {
  show: showWorkflowPanel,
  hide: hideWorkflowPanel,
  init: initWorkflowUI,
  loadWorkflows: loadWorkflows
};

// Initialize when document is loaded
console.log('Document ready state:', document.readyState);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWorkflowUI);
} else {
  initWorkflowUI();
} 