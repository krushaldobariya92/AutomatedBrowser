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

// Ask Gemma for a response to user input
async function askGemma(userMessage) {
  if (!window.gemma) {
    console.error("Gemma is not available");
    return "Sorry, I can't process that right now. Gemma is not available.";
  }

  try {
    updateZakResponse("Thinking...");
    
    // Get the current URL to provide context to Gemma
    const currentUrl = window.webview ? window.webview.src : "";
    
    // Getting page content for context
    let pageContent = "";
    if (window.webview) {
      try {
        pageContent = await window.webview.executeJavaScript(`
          document.documentElement.outerHTML
        `);
      } catch (e) {
        console.warn("Could not get page content", e);
      }
    }
    
    // Check for specific command patterns with regex
    
    // Pattern 1: Open X and search for Y on it
    const openAndSearchPattern = /^(open|go to|navigate to)\s+([a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,}))\s+and\s+(search|ask|find|look up)\s+(for|about)\s+(.+)$/i;
    const searchMatch = userMessage.match(openAndSearchPattern);
    
    if (searchMatch) {
      const [_, action, site, searchAction, preposition, query] = searchMatch;
      
      // First navigate to the site
      const domain = site.includes('.') ? site : `${site}.com`;
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      
      // Update response before navigation
      updateZakResponse(`Opening ${domain} and preparing to search for "${query}"...`);
      
      try {
        // Check for specific search engines and create appropriate URLs
        if (domain.toLowerCase().includes('perplexity')) {
          // Perplexity AI direct search URL
          const perplexitySearchUrl = `https://www.perplexity.ai/search/${encodeURIComponent(query)}`;
          navigateToUrl(perplexitySearchUrl);
          return `Searching for "${query}" on Perplexity AI...`;
        } 
        else if (domain.toLowerCase().includes('google')) {
          // Google search
          const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          navigateToUrl(googleSearchUrl);
          return `Searching for "${query}" on Google...`;
        }
        else if (domain.toLowerCase().includes('bing')) {
          // Bing search
          const bingSearchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
          navigateToUrl(bingSearchUrl);
          return `Searching for "${query}" on Bing...`;
        }
        else if (domain.toLowerCase().includes('duckduckgo')) {
          // DuckDuckGo search
          const ddgSearchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
          navigateToUrl(ddgSearchUrl);
          return `Searching for "${query}" on DuckDuckGo...`;
        }
        else if (domain.toLowerCase().includes('youtube')) {
          // YouTube search
          const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          navigateToUrl(youtubeSearchUrl);
          return `Searching for "${query}" on YouTube...`;
        }
        else {
          // For other sites, first navigate then try to find search functionality
          navigateToUrl(url);
          
          // Wait for navigation to complete
          await new Promise(resolve => {
            const navigationTimeout = setTimeout(() => {
              console.log("Navigation timeout reached");
              resolve();
            }, 5000);
            
            const navigationListener = () => {
              clearTimeout(navigationTimeout);
              // Wait a bit more for the page to render
              setTimeout(resolve, 1000);
            };
            
            window.webview.addEventListener('did-finish-load', navigationListener, { once: true });
          });
          
          // Try to perform search on the website
          try {
            const searchResult = await window.webview.executeJavaScript(`
              (function() {
                // Try to find search input
                const searchInputs = Array.from(document.querySelectorAll('input[type="search"], input[name*="search"], input[id*="search"], input[placeholder*="search"], input[class*="search"]'));
                
                if (searchInputs.length > 0) {
                  // Found a search input
                  const searchInput = searchInputs[0];
                  searchInput.value = ${JSON.stringify(query)};
                  searchInput.focus();
                  
                  // Try to submit the form
                  const form = searchInput.closest('form');
                  if (form) {
                    form.submit();
                    return { success: true, message: "Search submitted" };
                  } else {
                    // Try to trigger enter key event
                    const enterEvent = new KeyboardEvent('keydown', {
                      key: 'Enter',
                      code: 'Enter',
                      keyCode: 13,
                      which: 13,
                      bubbles: true
                    });
                    searchInput.dispatchEvent(enterEvent);
                    return { success: true, message: "Search triggered with enter key" };
                  }
                }
                
                return { success: false, message: "No search input found" };
              })();
            `);
            
            console.log("Search automation result:", searchResult);
            
            if (searchResult.success) {
              return `Searching for "${query}" on ${domain}...`;
            } else {
              return `I've opened ${domain}, but couldn't automate the search for "${query}". You may need to search manually.`;
            }
          } catch (searchError) {
            console.error("Error automating search:", searchError);
            return `I've opened ${domain}, but had trouble automating the search for "${query}".`;
          }
        }
      } catch (error) {
        console.error("Error during search navigation:", error);
        return `I tried to search for "${query}" on ${domain}, but encountered an error. Would you like me to try again or do something else?`;
      }
    }
    
    // Pattern 2: Simple "open X and do Y"
    const openAndDoPattern = /^(open|go to|navigate to)\s+([a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,}))\s+and\s+(.+)$/i;
    const match = userMessage.match(openAndDoPattern);
    
    if (match && !searchMatch) { // Only process if it's not already handled by search pattern
      // This is a complex command - "open X and do Y"
      const [_, action, site, task] = match;
      
      // First navigate to the site
      const domain = site.includes('.') ? site : `${site}.com`;
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      
      // Update response before navigation
      updateZakResponse(`Opening ${domain}...`);
      
      // Navigate to the site
      try {
        navigateToUrl(url);
        
        // Wait for navigation to complete
        await new Promise(resolve => {
          const navigationTimeout = setTimeout(() => {
            console.log("Navigation timeout reached");
            resolve();
          }, 5000);
          
          const navigationListener = () => {
            clearTimeout(navigationTimeout);
            // Wait a bit more for the page to render
            setTimeout(resolve, 1000);
          };
          
          window.webview.addEventListener('did-finish-load', navigationListener, { once: true });
        });
        
        // Now process the second part of the command with the new context
        const followupPrompt = `
          You are Zak, a helpful browser assistant.
          The user is now at: ${url}
          
          User asked to: "${task}"
          
          Determine the best way to help with this task on the current website.
          Return JSON with your response:
          {
            "action": "SEARCH | RESPOND | INTERACT",
            "response": "Your helpful response",
            "searchQuery": "Search query if action is SEARCH",
            "interactionSteps": ["Step 1", "Step 2"] // if action is INTERACT
          }
          
          Provide a clear, concise response focused on completing the requested task.
        `;
        
        const followupResult = await window.gemma.analyzeForm(followupPrompt, url);
        
        if (!followupResult.success) {
          return `I've opened ${domain}, but I'm having trouble processing the next step. Can you tell me more specifically what you'd like to do?`;
        }
        
        const followupResponse = followupResult.analysis;
        return followupResponse.response || `I've opened ${domain} and I'm ready to help with "${task}"`;
      } catch (error) {
        console.error("Error during navigation:", error);
        return `I tried to open ${domain}, but encountered an error. Would you like me to try again or do something else?`;
      }
    }
    
    // Pattern 3: Search on a specific site
    const searchOnSitePattern = /^(search|find|look up)\s+(on|in|at|using)\s+([a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,}))\s+(for|about)\s+(.+)$/i;
    const sitedSearchMatch = userMessage.match(searchOnSitePattern);
    
    if (sitedSearchMatch) {
      const [_, searchAction, preposition, site, forAbout, query] = sitedSearchMatch;
      const domain = site.includes('.') ? site : `${site}.com`;
      
      try {
        // Check for specific search engines and create appropriate URLs
        if (domain.toLowerCase().includes('perplexity')) {
          // Perplexity AI direct search URL
          const perplexitySearchUrl = `https://www.perplexity.ai/search/${encodeURIComponent(query)}`;
          navigateToUrl(perplexitySearchUrl);
          return `Searching for "${query}" on Perplexity AI...`;
        } 
        else if (domain.toLowerCase().includes('google')) {
          // Google search
          const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          navigateToUrl(googleSearchUrl);
          return `Searching for "${query}" on Google...`;
        }
        else if (domain.toLowerCase().includes('bing')) {
          // Bing search
          const bingSearchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
          navigateToUrl(bingSearchUrl);
          return `Searching for "${query}" on Bing...`;
        }
        else if (domain.toLowerCase().includes('duckduckgo')) {
          // DuckDuckGo search
          const ddgSearchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
          navigateToUrl(ddgSearchUrl);
          return `Searching for "${query}" on DuckDuckGo...`;
        }
        else if (domain.toLowerCase().includes('youtube')) {
          // YouTube search
          const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          navigateToUrl(youtubeSearchUrl);
          return `Searching for "${query}" on YouTube...`;
        }
        else {
          // For other search engines, default format
          const searchUrl = `https://${domain}/search?q=${encodeURIComponent(query)}`;
          navigateToUrl(searchUrl);
          return `Searching for "${query}" on ${domain}...`;
        }
      } catch (error) {
        console.error("Error during site-specific search:", error);
        return `I tried to search for "${query}" on ${domain}, but encountered an error. Would you like me to try again?`;
      }
    }
    
    // For simple commands or if not a complex pattern, use standard processing
    const prompt = `
      You are Zak, a helpful browser assistant. 
      The user is at URL: ${currentUrl}
      
      User message: "${userMessage}"
      
      Determine the user's intent and how to best help them.
      If they want to navigate to a website or perform a search, extract that information.
      If they're asking a question about the current page, use the page content to help answer.
      
      Always return your response in valid JSON format like this:
      {
        "action": "NAVIGATE | SEARCH | RESPOND | RELOAD | BACK | FORWARD",
        "url": "URL to navigate to if action is NAVIGATE",
        "searchQuery": "Search query if action is SEARCH",
        "response": "Helpful response to the user",
        "explanation": "Explanation of what you're doing"
      }
      
      Ensure your entire response is just this JSON object, formatted correctly.
    `;
    
    // We'll pass the prompt as the page content to reuse the existing API
    const result = await window.gemma.analyzeForm(prompt, currentUrl);
    
    if (!result.success) {
      console.error("Gemma processing failed:", result.message);
      return "I'm sorry, I couldn't process that request.";
    }
    
    const gemmaResponse = result.analysis;
    console.log("Gemma response:", gemmaResponse);
    
    // Safety check to ensure we have a valid action
    if (!gemmaResponse || !gemmaResponse.action) {
      console.warn("Invalid Gemma response format, missing action:", gemmaResponse);
      return processSimpleCommands(userMessage);
    }
    
    // Process the action
    switch (gemmaResponse.action) {
      case "NAVIGATE":
        if (!gemmaResponse.url) {
          return "I'd like to help you navigate, but I need a valid URL.";
        }
        
        try {
          navigateToUrl(gemmaResponse.url);
          return gemmaResponse.response || `Navigating to ${gemmaResponse.url}...`;
        } catch (error) {
          console.error("Navigation error:", error);
          return `I tried to navigate to ${gemmaResponse.url} but encountered an error. Would you like me to try again?`;
        }
        
      case "SEARCH":
        if (!gemmaResponse.searchQuery) {
          return "I'd like to search for you, but I need a search query.";
        }
        
        try {
          const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(gemmaResponse.searchQuery)}`;
          navigateToUrl(searchUrl);
          return gemmaResponse.response || `Searching for "${gemmaResponse.searchQuery}"...`;
        } catch (error) {
          console.error("Search error:", error);
          return `I tried to search for "${gemmaResponse.searchQuery}" but encountered an error. Would you like me to try again?`;
        }
        
      case "RELOAD":
        if (window.webview) {
          try {
            window.webview.reload();
            return gemmaResponse.response || "Reloading the page...";
          } catch (error) {
            console.error("Reload error:", error);
            return "I couldn't reload the page. Would you like me to try again?";
          }
        } else {
          return "I can't reload the page because the webview isn't available.";
        }
        
      case "BACK":
        if (window.webview && window.webview.canGoBack()) {
          try {
            window.webview.goBack();
            return gemmaResponse.response || "Going back...";
          } catch (error) {
            console.error("Back navigation error:", error);
            return "I couldn't go back. Would you like me to try something else?";
          }
        } else {
          return "Can't go back any further.";
        }
        
      case "FORWARD":
        if (window.webview && window.webview.canGoForward()) {
          try {
            window.webview.goForward();
            return gemmaResponse.response || "Going forward...";
          } catch (error) {
            console.error("Forward navigation error:", error);
            return "I couldn't go forward. Would you like me to try something else?";
          }
        } else {
          return "Can't go forward any further.";
        }
        
      case "RESPOND":
      default:
        return gemmaResponse.response || "I'm not sure how to help with that.";
    }
  } catch (error) {
    console.error("Error processing with Gemma:", error);
    // Fall back to simple processing if Gemma fails
    return processSimpleCommands(userMessage);
  }
}

// Simple command processing (fallback when Gemma isn't available)
function processSimpleCommands(input) {
  const lowerInput = input.toLowerCase().trim();
  
  // Handle navigation commands
  if (lowerInput.startsWith('go to ') || lowerInput.startsWith('navigate to ') || lowerInput.startsWith('open ')) {
    const url = lowerInput.replace(/^(go to |navigate to |open )/, '').trim();
    navigateToUrl(url);
    return `Navigating to ${url}...`;
  }
  
  // Handle search commands
  if (lowerInput.startsWith('search for ') || lowerInput.startsWith('search ')) {
    const query = lowerInput.replace(/^(search for |search )/, '').trim();
    navigateToUrl(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
    return `Searching for "${query}"...`;
  }
  
  // Handle refresh command
  if (lowerInput === 'refresh' || lowerInput === 'reload') {
    if (window.webview) {
      window.webview.reload();
    }
    return 'Refreshing the page...';
  }
  
  // Handle back command
  if (lowerInput === 'back' || lowerInput === 'go back') {
    if (window.webview && window.webview.canGoBack()) {
      window.webview.goBack();
      return 'Going back...';
    } else {
      return "Can't go back any further.";
    }
  }
  
  // Handle forward command
  if (lowerInput === 'forward' || lowerInput === 'go forward') {
    if (window.webview && window.webview.canGoForward()) {
      window.webview.goForward();
      return 'Going forward...';
    } else {
      return "Can't go forward any further.";
    }
  }
  
  // Handle help command
  if (lowerInput === 'help' || lowerInput === 'commands' || lowerInput === 'what can you do') {
    return `
      I can help you navigate the web. Try these commands:
      - "go to example.com" - Navigate to a website
      - "open google.com" - Open a website
      - "search for cats" - Search for something
      - "refresh" or "reload" - Refresh the current page
      - "back" or "go back" - Go back to the previous page
      - "forward" or "go forward" - Go forward to the next page
      - "help" or "commands" - Show this help message
    `;
  }
  
  // Handle direct URL input (if it looks like a URL)
  if (lowerInput.includes('.') && !lowerInput.includes(' ')) {
    navigateToUrl(lowerInput);
    return `Navigating to ${lowerInput}...`;
  }
  
  // If no command is recognized, treat as a search query
  navigateToUrl(`https://duckduckgo.com/?q=${encodeURIComponent(input)}`);
  return `Searching for "${input}"...`;
}

// Process user input and generate a response
async function processUserInput(input) {
  // Add user message to chat
  addUserMessage(input);
  
  try {
    // Try to use Gemma for smart responses
    const response = await askGemma(input);
    updateZakResponse(response);
  } catch (error) {
    console.error("Error processing input:", error);
    // Fall back to simple command processing
    const response = processSimpleCommands(input);
    updateZakResponse(response);
  }
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
  
  console.log(`Navigating to: ${url}`);
  
  // Create a new tab if this is an explicit navigation command
  const shouldCreateNewTab = window.tabs && window.tabs.length > 0 && currentUrlIsNotBlank();
  
  if (shouldCreateNewTab) {
    console.log("Creating new tab for navigation");
    if (window.newTabBtn) {
      // Use the existing new tab function
      window.newTabBtn.click();
    } else {
      // Manually create a new tab
      const newId = window.tabs ? window.tabs.length + 1 : 1;
      
      if (window.tabs) {
        window.tabs.push({
          id: newId,
          title: `Tab ${newId}`,
          url: url,
          active: true
        });
        window.tabs = window.tabs.map(t => ({ ...t, active: t.id === newId }));
      }
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
  
  // If window.renderTabs exists, call it to update the UI
  if (window.renderTabs) {
    window.renderTabs();
  }
}

// Helper to check if the current URL is not blank/new tab
function currentUrlIsNotBlank() {
  if (!window.webview) return false;
  
  const currentUrl = window.webview.src;
  return currentUrl && 
         currentUrl !== 'about:blank' && 
         !currentUrl.includes('duckduckgo.com') &&
         currentUrl !== 'https://duckduckgo.com/';
}

// Export functions for potential use in other modules
window.zak = {
  updateResponse: updateZakResponse,
  navigateToUrl: navigateToUrl,
  processInput: processUserInput
}; 