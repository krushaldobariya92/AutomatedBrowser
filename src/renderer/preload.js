// Preload script for webview
const { ipcRenderer } = require('electron');

// Intercept form submissions
document.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script loaded');
  
  // Monitor all form submissions
  document.addEventListener('submit', (event) => {
    console.log('Form submitted:', event.target);
    
    // Get the form data
    const formData = new FormData(event.target);
    const formEntries = Array.from(formData.entries());
    console.log('Form data:', formEntries);
    
    // For DuckDuckGo search form
    if (event.target.action && event.target.action.includes('duckduckgo.com')) {
      const searchInput = event.target.querySelector('input[name="q"]');
      if (searchInput) {
        console.log('DuckDuckGo search detected:', searchInput.value);
        // Notify the main process about the search
        ipcRenderer.sendToHost('search-submitted', { 
          query: searchInput.value,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(searchInput.value)}`
        });
      }
    }
    
    // Allow the form submission to proceed normally
  });
  
  // Monitor all link clicks
  document.addEventListener('click', (event) => {
    // Check if the click is on a link
    let target = event.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }
    
    if (target && target.tagName === 'A') {
      console.log('Link clicked:', target.href);
      // Notify the main process about the link click
      ipcRenderer.sendToHost('link-clicked', { 
        url: target.href
      });
      // Allow the link click to proceed normally
    }
  });
  
  // Notify when the page is fully loaded
  window.addEventListener('load', () => {
    console.log('Page fully loaded');
    ipcRenderer.sendToHost('page-loaded', { 
      title: document.title,
      url: window.location.href
    });
    
    // Special handling for DuckDuckGo search
    if (window.location.href.includes('duckduckgo.com')) {
      console.log('DuckDuckGo page detected, adding special handlers');
      
      // Find the search form
      const searchForm = document.querySelector('form[action="/"]');
      if (searchForm) {
        console.log('DuckDuckGo search form found');
        
        // Add a submit event listener
        searchForm.addEventListener('submit', (e) => {
          const searchInput = searchForm.querySelector('input[name="q"]');
          if (searchInput) {
            console.log('DuckDuckGo search submitted:', searchInput.value);
            // Notify the main process about the search
            ipcRenderer.sendToHost('search-submitted', { 
              query: searchInput.value,
              url: `https://duckduckgo.com/?q=${encodeURIComponent(searchInput.value)}`
            });
          }
        });
      }
    }
  });
});

// Expose a function to get the current URL
window.getCurrentUrl = () => {
  return window.location.href;
};

// Expose a function to get the page title
window.getPageTitle = () => {
  return document.title;
}; 