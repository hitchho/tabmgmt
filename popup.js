/**
 * Manage Tabs by Domain - Popup Controller
 * Modern implementation with improved UX
 */

/**
 * Handle button clicks in the popup
 * 
 * @param {Event} e - Click event
 */
function handleButtonClick(e) {
  // Get the closest button element (handles clicks on child elements)
  const button = e.target.closest('button');
  if (!button) return;
  
  // Get command ID from button
  const commandId = button.id;
  
  // Add visual feedback
  button.classList.add('scale-95');
  
  // Send message to background service worker
  chrome.runtime.sendMessage({ cmd: commandId })
    .catch(err => console.error('Error sending command:', err));
}

/**
 * Add keyboard shortcut support for the popup
 * 
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleKeydown(e) {
  // Map keys to commands
  const keyMap = {
    'c': 'close-tabs',
    'g': 'gather-tabs',
    'a': 'gather-tabs-all'
  };
  
  const key = e.key.toLowerCase();
  
  if (keyMap[key]) {
    // Find the corresponding button and simulate a click
    const button = document.getElementById(keyMap[key]);
    if (button) {
      button.click();
      e.preventDefault();
    }
  }
}

/**
 * Open the Chrome extensions shortcuts page
 */
function openShortcuts(e) {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
}

/**
 * Initialize the popup
 */
function initPopup() {
  // Add event listeners to all buttons
  document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', handleButtonClick);
  });

  // Add keyboard navigation support
  document.addEventListener('keydown', handleKeydown);

  // Add shortcuts link handler
  document.getElementById('open-shortcuts').addEventListener('click', openShortcuts);
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initPopup);
