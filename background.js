// Background service worker for Jim's Language Tool

chrome.runtime.onInstalled.addListener(() => {
  console.log('Jim\'s Language Tool installed');
  
  // Initialize storage
  chrome.storage.sync.get(['allowedUrls'], (result) => {
    if (!result.allowedUrls) {
      chrome.storage.sync.set({ allowedUrls: [] });
    }
  });
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { action: 'urlsUpdated' }).catch(() => {
      // Ignore errors if content script isn't loaded
    });
  }
});
