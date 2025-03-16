const tabsContainer = document.getElementById('tabs');
const urlBar = document.getElementById('urlBar');
const webview = document.getElementById('webview');
const newTabBtn = document.getElementById('newTabBtn');

// Make these variables globally accessible
window.urlBar = urlBar;
window.webview = webview;

window.tabs = [{ id: 1, title: 'Tab 1', url: 'https://duckduckgo.com', active: true }];

// Debug: Confirm elements exist
console.log('tabsContainer:', tabsContainer);
console.log('urlBar:', urlBar);
console.log('webview:', webview);
console.log('newTabBtn:', newTabBtn);

// Navigation error handling
const MAX_RETRY_ATTEMPTS = 3;
const navigationRetryState = {
  attempts: 0,
  lastUrl: '',
  retryTimers: {}
};

function handleNavigationError(url, error) {
  console.warn(`Navigation error to ${url}: ${error}`);

  // Check if we're already retrying this URL
  if (navigationRetryState.lastUrl === url) {
    navigationRetryState.attempts++;
    
    if (navigationRetryState.attempts > MAX_RETRY_ATTEMPTS) {
      console.error(`Exceeded maximum retry attempts (${MAX_RETRY_ATTEMPTS}) for ${url}`);
      return false; // Don't retry anymore
    }
  } else {
    // New URL to retry
    navigationRetryState.lastUrl = url;
    navigationRetryState.attempts = 1;
  }
  
  // Clear any existing retry timer for this URL
  if (navigationRetryState.retryTimers[url]) {
    clearTimeout(navigationRetryState.retryTimers[url]);
  }
  
  // Set a new retry timer
  const delay = navigationRetryState.attempts * 1000; // Incremental backoff
  console.log(`Will retry navigation to ${url} in ${delay}ms`);
  
  navigationRetryState.retryTimers[url] = setTimeout(() => {
    console.log(`Retrying navigation to ${url} (attempt ${navigationRetryState.attempts})`);
    webview.src = url;
  }, delay);
  
  return true; // We're handling the retry
}

function renderTabs() {
  const tabsList = document.createElement('div');
  window.tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab ${tab.active ? 'active' : ''}`;
    tabEl.textContent = tab.title;
    tabEl.onclick = () => {
      window.tabs = window.tabs.map(t => ({ ...t, active: t.id === tab.id }));
      
      try {
        webview.src = tab.url;
        urlBar.value = tab.url; // Update URL bar when switching tabs
      } catch (err) {
        console.error('Error switching tabs:', err);
        handleNavigationError(tab.url, err);
      }
      
      renderTabs();
    };
    tabsList.appendChild(tabEl);
  });
  tabsContainer.innerHTML = '';
  tabsContainer.appendChild(newTabBtn);
  tabsContainer.appendChild(tabsList);
}

// Make renderTabs globally accessible
window.renderTabs = renderTabs;

newTabBtn.addEventListener('click', () => {
  const newId = window.tabs.length + 1;
  window.tabs.push({
    id: newId,
    title: `Tab ${newId}`,
    url: 'https://duckduckgo.com',
    active: true
  });
  window.tabs = window.tabs.map(t => ({ ...t, active: t.id === newId }));
  webview.src = 'https://duckduckgo.com';
  urlBar.value = 'https://duckduckgo.com'; // Update URL bar for new tab
  renderTabs();
});

// Ensure urlBar exists before adding listener
if (urlBar) {
  urlBar.addEventListener('keypress', (e) => {
    console.log('Key pressed:', e.key, 'URL:', urlBar.value); // Debug
    if (e.key === 'Enter') {
      let url = urlBar.value.trim();
      
      // Handle empty URL
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
      
      console.log('Navigating to:', url); // Debug
      
      try {
        // Update the active tab's URL
        window.tabs = window.tabs.map(t => (t.active ? { ...t, url } : t));
        
        // Force webview to navigate
        if (webview) {
          webview.src = url;
          console.log('Webview src set to:', webview.src); // Debug
        } else {
          console.error('Webview element not found'); // Debug
        }
      } catch (err) {
        console.error('Error navigating:', err); // Debug
        handleNavigationError(url, err);
      }
    }
  });
} else {
  console.error('urlBar element not found'); // Debug
}

// Set up webview event listeners
if (webview) {
  // Track loading state
  webview.addEventListener('did-start-loading', () => {
    console.log('Webview started loading');
  });
  
  webview.addEventListener('did-stop-loading', () => {
    console.log('Webview stopped loading');
    // Reset navigation retry state when a page successfully loads
    navigationRetryState.attempts = 0;
  });
  
  webview.addEventListener('did-fail-load', (event) => {
    console.error('Webview failed to load:', event);
    
    // Check if it's an ERR_ABORTED error, which is often temporary
    if (event.errorCode === -3 || event.errorDescription?.includes('ERR_ABORTED')) {
      const currentUrl = webview.src;
      handleNavigationError(currentUrl, `ERR_ABORTED (${event.errorCode})`);
    }
  });
  
  webview.addEventListener('did-finish-load', () => {
    console.log('Webview finished loading');
    // Update tab title with page title
    const activeTabIndex = window.tabs.findIndex(t => t.active);
    if (activeTabIndex !== -1) {
      window.tabs[activeTabIndex].title = webview.getTitle() || window.tabs[activeTabIndex].url;
      renderTabs();
    }
  });
  
  // Track navigation within the webview
  webview.addEventListener('did-navigate', (e) => {
    console.log('Webview navigated to:', e.url);
    urlBar.value = e.url;
    
    // Update active tab URL
    const activeTabIndex = window.tabs.findIndex(t => t.active);
    if (activeTabIndex !== -1) {
      window.tabs[activeTabIndex].url = e.url;
    }
  });
  
  webview.addEventListener('did-navigate-in-page', (e) => {
    console.log('Webview navigated in page to:', e.url);
    urlBar.value = e.url;
    
    // Update active tab URL
    const activeTabIndex = window.tabs.findIndex(t => t.active);
    if (activeTabIndex !== -1) {
      window.tabs[activeTabIndex].url = e.url;
    }
  });
}

// Initial render
renderTabs();

// Set initial URL in the URL bar
if (urlBar && webview) {
  urlBar.value = webview.src;
}