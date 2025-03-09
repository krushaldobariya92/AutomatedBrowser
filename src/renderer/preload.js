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
    
    // Capture form submission for workflow recording
    const formElements = Array.from(event.target.elements).filter(el => 
      el.name && 
      !el.disabled && 
      ['input', 'select', 'textarea'].includes(el.tagName.toLowerCase()) &&
      !['submit', 'button', 'image', 'reset', 'file'].includes(el.type)
    );
    
    const formFields = formElements.map(el => {
      // Generate a unique selector for this element
      const selector = generateSelector(el);
      
      return {
        selector,
        name: el.name,
        type: el.type || el.tagName.toLowerCase(),
        value: el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value
      };
    });
    
    if (formFields.length > 0) {
      ipcRenderer.sendToHost('form-submitted', {
        formSelector: generateSelector(event.target),
        fields: formFields
      });
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
  
  // Monitor form input changes
  document.addEventListener('change', (event) => {
    const target = event.target;
    
    // Only capture form elements
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
      return;
    }
    
    // Skip submit buttons and file inputs
    if (target.type === 'submit' || target.type === 'button' || 
        target.type === 'image' || target.type === 'reset' || 
        target.type === 'file') {
      return;
    }
    
    console.log('Form input changed:', target);
    
    // Generate a selector for this element
    const selector = generateSelector(target);
    
    // Capture the input event for workflow recording
    if (target.type === 'checkbox' || target.type === 'radio') {
      ipcRenderer.sendToHost('input-changed', {
        type: target.type,
        selector,
        checked: target.checked,
        value: target.value
      });
    } else if (target.tagName === 'SELECT') {
      ipcRenderer.sendToHost('input-changed', {
        type: 'select',
        selector,
        value: target.value
      });
    } else {
      ipcRenderer.sendToHost('input-changed', {
        type: target.type || 'input',
        selector,
        value: target.value
      });
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
  
  // Listen for form template application
  ipcRenderer.on('apply-form-template', (event, template) => {
    console.log('Applying form template:', template);
    
    if (!template || !template.fields || !Array.isArray(template.fields)) {
      console.error('Invalid template format');
      return;
    }
    
    // Apply each field
    template.fields.forEach(field => {
      try {
        if (!field.selector) {
          console.error('Field missing selector:', field);
          return;
        }
        
        const element = document.querySelector(field.selector);
        if (!element) {
          console.error('Element not found:', field.selector);
          return;
        }
        
        // Set value based on element type
        const tagName = element.tagName.toLowerCase();
        const type = element.type ? element.type.toLowerCase() : '';
        
        if (tagName === 'input') {
          if (type === 'checkbox' || type === 'radio') {
            element.checked = field.value === true || field.value === 'true' || field.value === 1;
          } else if (type !== 'file') { // Skip file inputs
            element.value = field.value;
          }
        } else if (tagName === 'select' || tagName === 'textarea') {
          element.value = field.value;
        }
        
        // Trigger events
        if (type === 'checkbox' || type === 'radio' || tagName === 'select') {
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        console.log('Applied field:', field.selector, field.value);
      } catch (error) {
        console.error('Error applying field:', field, error);
      }
    });
    
    // Notify that template was applied
    ipcRenderer.sendToHost('template-applied', { 
      success: true,
      templateName: template.name
    });
  });
  
  // Listen for form capture request
  ipcRenderer.on('capture-form', () => {
    console.log('Capturing form fields on page');
    
    // Find all forms on the page
    const forms = document.querySelectorAll('form');
    if (forms.length === 0) {
      console.log('No forms found on page');
      ipcRenderer.sendToHost('form-captured', { fields: [] });
      return;
    }
    
    // Use the first form or the largest form by number of fields
    let targetForm = forms[0];
    if (forms.length > 1) {
      // Find the form with the most input fields
      let maxFields = 0;
      forms.forEach(form => {
        const fieldCount = form.querySelectorAll('input, select, textarea').length;
        if (fieldCount > maxFields) {
          maxFields = fieldCount;
          targetForm = form;
        }
      });
    }
    
    // Get all input fields
    const formElements = Array.from(targetForm.elements).filter(el => 
      !el.disabled && 
      ['input', 'select', 'textarea'].includes(el.tagName.toLowerCase()) &&
      !['submit', 'button', 'image', 'reset', 'file'].includes(el.type)
    );
    
    // Create field data
    const fields = formElements.map(el => {
      return {
        name: el.name || '',
        selector: generateSelector(el),
        type: el.type || el.tagName.toLowerCase(),
        value: el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value
      };
    });
    
    // Send captured form data
    ipcRenderer.sendToHost('form-captured', {
      formSelector: generateSelector(targetForm),
      fields
    });
  });
});

// Helper function to generate a unique selector for an element
function generateSelector(element) {
  // Try to use ID if available
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Try to use name for form elements
  if (element.name && ['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
    // Add more specificity with element type
    return `${element.tagName.toLowerCase()}[name="${element.name}"]`;
  }
  
  // Use classes if available
  if (element.className && typeof element.className === 'string' && element.className.trim()) {
    const classes = element.className.trim().split(/\s+/);
    if (classes.length > 0) {
      // Use the first class and tag name for better specificity
      return `${element.tagName.toLowerCase()}.${classes[0]}`;
    }
  }
  
  // Fallback to a more complex selector with parent relationships
  let selector = element.tagName.toLowerCase();
  let parent = element.parentElement;
  let index = 0;
  
  // Find the element's index among siblings of the same type
  const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
  if (siblings.length > 1) {
    index = siblings.indexOf(element) + 1;
    selector += `:nth-of-type(${index})`;
  }
  
  // Add parent information for more specificity (up to 2 levels)
  let depth = 0;
  while (parent && parent.tagName !== 'BODY' && depth < 2) {
    let parentSelector = parent.tagName.toLowerCase();
    
    if (parent.id) {
      parentSelector = `#${parent.id}`;
    } else if (parent.className && typeof parent.className === 'string' && parent.className.trim()) {
      const classes = parent.className.trim().split(/\s+/);
      if (classes.length > 0) {
        parentSelector += `.${classes[0]}`;
      }
    }
    
    selector = `${parentSelector} > ${selector}`;
    parent = parent.parentElement;
    depth++;
  }
  
  return selector;
}

// Expose a function to get the current URL
window.getCurrentUrl = () => {
  return window.location.href;
};

// Expose a function to get the page title
window.getPageTitle = () => {
  return document.title;
}; 