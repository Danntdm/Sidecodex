const panelState = new Map();

// Toggle side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
    const windowId = tab.windowId;
    const isOpen = panelState.get(windowId) || false;
    
    try {
        if (isOpen) {
            await chrome.sidePanel.close({ windowId });
            panelState.set(windowId, false);
        } else {
            await chrome.sidePanel.open({ windowId });
            panelState.set(windowId, true);
        }
    } catch (error) {
        panelState.set(windowId, !isOpen);
    }
});