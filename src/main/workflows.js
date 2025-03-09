// workflows.js - Manages background workflows and automation
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Store for active workflow recordings
let isRecording = false;
let currentWorkflow = [];
let workflowName = '';
let activeWorkflows = {};

// Path to store workflows
const workflowsDir = path.join(__dirname, '../../data');

// Ensure the workflows directory exists
function ensureWorkflowsDir() {
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }
  
  const workflowsFile = path.join(workflowsDir, 'workflows.json');
  if (!fs.existsSync(workflowsFile)) {
    fs.writeFileSync(workflowsFile, JSON.stringify({}), 'utf8');
  }
}

// Load all saved workflows
function loadWorkflows() {
  ensureWorkflowsDir();
  const workflowsFile = path.join(workflowsDir, 'workflows.json');
  try {
    return JSON.parse(fs.readFileSync(workflowsFile, 'utf8'));
  } catch (error) {
    console.error('Error loading workflows:', error);
    return {};
  }
}

// Save workflows to file
function saveWorkflows(workflows) {
  ensureWorkflowsDir();
  const workflowsFile = path.join(workflowsDir, 'workflows.json');
  fs.writeFileSync(workflowsFile, JSON.stringify(workflows, null, 2), 'utf8');
}

// Start recording a new workflow
function startRecording(name) {
  if (isRecording) {
    return { success: false, message: 'Already recording a workflow' };
  }
  
  workflowName = name || `Workflow_${Date.now()}`;
  currentWorkflow = [];
  isRecording = true;
  
  return { success: true, message: `Started recording workflow: ${workflowName}` };
}

// Stop recording and save the workflow
function stopRecording() {
  if (!isRecording) {
    return { success: false, message: 'No active recording' };
  }
  
  isRecording = false;
  
  // Don't save empty workflows
  if (currentWorkflow.length === 0) {
    return { success: false, message: 'Workflow is empty, nothing to save' };
  }
  
  // Save the workflow
  const workflows = loadWorkflows();
  workflows[workflowName] = {
    id: crypto.randomUUID(),
    name: workflowName,
    steps: currentWorkflow,
    createdAt: Date.now(),
    lastRun: null
  };
  
  saveWorkflows(workflows);
  return { 
    success: true, 
    message: `Saved workflow: ${workflowName}`,
    workflow: workflows[workflowName]
  };
}

// Add a step to the current recording
function recordStep(step) {
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
}

// Run a workflow by name
function runWorkflow(name) {
  const workflows = loadWorkflows();
  
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
  saveWorkflows(workflows);
  
  return { 
    success: true, 
    message: `Started workflow: ${name}`,
    workflowId
  };
}

// Get the next step in a running workflow
function getNextStep(workflowId) {
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
}

// Get all saved workflows
function getWorkflows() {
  return loadWorkflows();
}

// Delete a workflow
function deleteWorkflow(name) {
  const workflows = loadWorkflows();
  
  if (!workflows[name]) {
    return { success: false, message: `Workflow not found: ${name}` };
  }
  
  delete workflows[name];
  saveWorkflows(workflows);
  
  return { success: true, message: `Deleted workflow: ${name}` };
}

// Initialize module and set up IPC listeners
function initialize() {
  ensureWorkflowsDir();
  
  // Set up IPC handlers for communication with renderer process
  ipcMain.handle('workflow:startRecording', (event, name) => {
    return startRecording(name);
  });
  
  ipcMain.handle('workflow:stopRecording', () => {
    return stopRecording();
  });
  
  ipcMain.handle('workflow:recordStep', (event, step) => {
    return recordStep(step);
  });
  
  ipcMain.handle('workflow:getWorkflows', () => {
    return getWorkflows();
  });
  
  ipcMain.handle('workflow:runWorkflow', (event, name) => {
    return runWorkflow(name);
  });
  
  ipcMain.handle('workflow:getNextStep', (event, workflowId) => {
    return getNextStep(workflowId);
  });
  
  ipcMain.handle('workflow:deleteWorkflow', (event, name) => {
    return deleteWorkflow(name);
  });
  
  console.log('Workflow system initialized');
}

module.exports = {
  initialize,
  startRecording,
  stopRecording,
  recordStep,
  runWorkflow,
  getNextStep,
  getWorkflows,
  deleteWorkflow,
  isRecording: () => isRecording
}; 