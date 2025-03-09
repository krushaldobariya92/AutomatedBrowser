// Zak UI - Text-based assistant functionality
const zakInput = document.getElementById('zakInput');
const zakSendBtn = document.getElementById('zakSendBtn');
const zakMessages = document.getElementById('zakMessages');
// Use existing urlBar and webview from tabs-ui.js instead of redeclaring
// const urlBar = document.getElementById('urlBar');
// const webview = document.getElementById('webview');

// Check if elements exist
console.log('zakInput:', zakInput);
console.log('zakSendBtn:', zakSendBtn);
console.log('zakMessages:', zakMessages);

// Simple function to update Zak's response
function updateZakResponse(message) {
  if (zakMessages) {
    const messageElement = document.createElement('div');
    messageElement.textContent = `Zak: ${message}`;
    zakMessages.appendChild(messageElement);
    // Scroll to the bottom to show the latest message
    zakMessages.scrollTop = zakMessages.scrollHeight;
  }
}

// Simple function to add user message to the chat
function addUserMessage(message) {
  if (zakMessages) {
    const messageElement = document.createElement('div');
    messageElement.textContent = `You: ${message}`;
    messageElement.style.fontWeight = 'bold';
    zakMessages.appendChild(messageElement);
    // Scroll to the bottom to show the latest message
    zakMessages.scrollTop = zakMessages.scrollHeight;
  }
}

// Process user input and generate a response
function processUserInput(input) {
  // Add user message to chat
  addUserMessage(input);
  
  // Simple command processing
  const lowerInput = input.toLowerCase().trim();
  
  // Handle navigation commands
  if (lowerInput.startsWith('go to ') || lowerInput.startsWith('navigate to ') || lowerInput.startsWith('open ')) {
    const url = lowerInput.replace(/^(go to |navigate to |open )/, '').trim();
    updateZakResponse(`Navigating to ${url}...`);
    navigateToUrl(url);
    return;
  }
  
  // Handle search commands
  if (lowerInput.startsWith('search for ') || lowerInput.startsWith('search ')) {
    const query = lowerInput.replace(/^(search for |search )/, '').trim();
    updateZakResponse(`Searching for "${query}"...`);
    navigateToUrl(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
    return;
  }
  
  // Handle refresh command
  if (lowerInput === 'refresh' || lowerInput === 'reload') {
    updateZakResponse('Refreshing the page...');
    if (window.webview) {
      window.webview.reload();
    }
    return;
  }
  
  // Handle back command
  if (lowerInput === 'back' || lowerInput === 'go back') {
    updateZakResponse('Going back...');
    if (window.webview && window.webview.canGoBack()) {
      window.webview.goBack();
    } else {
      updateZakResponse("Can't go back any further.");
    }
    return;
  }
  
  // Handle forward command
  if (lowerInput === 'forward' || lowerInput === 'go forward') {
    updateZakResponse('Going forward...');
    if (window.webview && window.webview.canGoForward()) {
      window.webview.goForward();
    } else {
      updateZakResponse("Can't go forward any further.");
    }
    return;
  }
  
  // Handle help command
  if (lowerInput === 'help' || lowerInput === 'commands' || lowerInput === 'what can you do') {
    updateZakResponse(`
      I can help you navigate the web. Try these commands:
      - "go to example.com" - Navigate to a website
      - "open google.com" - Open a website
      - "search for cats" - Search for something
      - "refresh" or "reload" - Refresh the current page
      - "back" or "go back" - Go back to the previous page
      - "forward" or "go forward" - Go forward to the next page
      - "help" or "commands" - Show this help message
    `);
    return;
  }
  
  // Handle direct URL input (if it looks like a URL)
  if (lowerInput.includes('.') && !lowerInput.includes(' ')) {
    updateZakResponse(`Navigating to ${lowerInput}...`);
    navigateToUrl(lowerInput);
    return;
  }
  
  // If no command is recognized, treat as a search query
  updateZakResponse(`Searching for "${input}"...`);
  navigateToUrl(`https://duckduckgo.com/?q=${encodeURIComponent(input)}`);
}

// Handle send button click
if (zakSendBtn) {
  zakSendBtn.addEventListener('click', () => {
    if (zakInput && zakInput.value.trim()) {
      const userInput = zakInput.value.trim();
      processUserInput(userInput);
      zakInput.value = ''; // Clear input after sending
    }
  });
}

// Handle Enter key in input field
if (zakInput) {
  zakInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && zakInput.value.trim()) {
      const userInput = zakInput.value.trim();
      processUserInput(userInput);
      zakInput.value = ''; // Clear input after sending
    }
  });
}

// Listen for navigation events to update Zak's status
if (window.webview) {
  window.webview.addEventListener('did-start-loading', () => {
    updateZakResponse('Loading page...');
  });
  
  window.webview.addEventListener('did-finish-load', () => {
    updateZakResponse('Page loaded successfully!');
  });
  
  window.webview.addEventListener('did-fail-load', (event) => {
    updateZakResponse(`Failed to load page: ${event.errorDescription || 'Unknown error'}`);
  });
}

// Helper function to navigate to a URL
function navigateToUrl(url) {
  if (!url) return;
  
  // Add https:// if not present and not a local file
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
    // Check if it's a valid domain-like input
    if (url.includes('.') || url.startsWith('localhost')) {
      url = `https://${url}`;
    } else {
      // Treat as a search query
      url = `https://duckduckgo.com/?q=${encodeURIComponent(url)}`;
    }
  }
  
  // Update URL bar
  if (window.urlBar) window.urlBar.value = url;
  
  // Navigate webview
  if (window.webview) window.webview.src = url;
  
  // Update active tab
  if (window.tabs) {
    window.tabs = window.tabs.map(t => (t.active ? { ...t, url } : t));
  }
}

// Export functions for potential use in other modules
window.zak = {
  updateResponse: updateZakResponse,
  navigateToUrl: navigateToUrl,
  processInput: processUserInput
}; 