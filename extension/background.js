// Minimal service worker for the Popform extension.
// Configures the toolbar icon to open the side panel on click. Without this,
// the icon does nothing because we removed `default_popup` from the action.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[Popform] setPanelBehavior failed:', err));
});

// Also run on startup in case the extension was already installed before this
// listener was added (e.g. when reloading during development).
chrome.runtime.onStartup?.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});
