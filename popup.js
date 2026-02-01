// Get current tab URL and display it
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    const url = new URL(tabs[0].url);
    const domain = url.hostname;
    document.getElementById('currentUrl').textContent = domain;
    
    // Check if current page is allowed
    chrome.storage.sync.get(['allowedUrls'], (result) => {
      const allowedUrls = result.allowedUrls || [];
      const isAllowed = allowedUrls.some(allowed => domain.includes(allowed) || allowed.includes(domain));
      showStatus(isAllowed);
    });
  }
});

// Show status message
function showStatus(isAllowed) {
  const statusCard = document.getElementById('statusCard');
  const statusText = document.getElementById('statusText');
  
  if (isAllowed) {
    statusCard.className = 'status-card active';
    statusText.textContent = '✓ Grammar checking is ACTIVE';
  } else {
    statusCard.className = 'status-card inactive';
    statusText.textContent = '✗ Grammar checking is INACTIVE';
  }
}

// Load and display allowed URLs
function loadUrls() {
  chrome.storage.sync.get(['allowedUrls'], (result) => {
    const urlList = document.getElementById('urlList');
    const allowedUrls = result.allowedUrls || [];
    
    if (allowedUrls.length === 0) {
      urlList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          No URLs added yet.<br>Add URLs to enable checking.
        </div>
      `;
      return;
    }
    
    urlList.innerHTML = '';
    allowedUrls.forEach((url) => {
      const item = document.createElement('div');
      item.className = 'url-item';
      item.innerHTML = `
        <span class="url-text">${url}</span>
        <button class="btn-remove" data-url="${url}">Remove</button>
      `;
      urlList.appendChild(item);
    });
    
    // Add remove button listeners
    document.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const urlToRemove = e.target.getAttribute('data-url');
        removeUrl(urlToRemove);
      });
    });
  });
}

// Add current page URL
document.getElementById('addCurrent').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname;
      addUrl(domain);
    }
  });
});

// Add URL from input
document.getElementById('addUrl').addEventListener('click', () => {
  const input = document.getElementById('urlInput');
  const url = input.value.trim();
  
  if (url) {
    const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    addUrl(cleanUrl);
    input.value = '';
  }
});

// Allow Enter key to add URL
document.getElementById('urlInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addUrl').click();
  }
});

// Add URL to storage
function addUrl(url) {
  chrome.storage.sync.get(['allowedUrls'], (result) => {
    const allowedUrls = result.allowedUrls || [];
    
    if (!allowedUrls.includes(url)) {
      allowedUrls.push(url);
      chrome.storage.sync.set({ allowedUrls }, () => {
        loadUrls();
        
        // Notify content script to refresh
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'urlsUpdated' });
            
            // Update status
            const currentUrl = new URL(tabs[0].url);
            const domain = currentUrl.hostname;
            const isAllowed = allowedUrls.some(allowed => domain.includes(allowed) || allowed.includes(domain));
            showStatus(isAllowed);
          }
        });
      });
    }
  });
}

// Remove URL from storage
function removeUrl(url) {
  chrome.storage.sync.get(['allowedUrls'], (result) => {
    let allowedUrls = result.allowedUrls || [];
    allowedUrls = allowedUrls.filter(u => u !== url);
    
    chrome.storage.sync.set({ allowedUrls }, () => {
      loadUrls();
      
      // Notify content script to refresh
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'urlsUpdated' });
          
          // Update status
          const currentUrl = new URL(tabs[0].url);
          const domain = currentUrl.hostname;
          const isAllowed = allowedUrls.some(allowed => domain.includes(allowed) || allowed.includes(domain));
          showStatus(isAllowed);
        }
      });
    });
  });
}

// Load URLs on popup open
loadUrls();
loadDictionary();

// Load and display custom dictionary
function loadDictionary() {
  chrome.storage.sync.get(['customDictionary'], (result) => {
    const dictList = document.getElementById('dictionaryList');
    const customDict = result.customDictionary || [];
    
    if (customDict.length === 0) {
      dictList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📖</div>
          No custom words yet.<br>Add words to ignore them in spell check.
        </div>
      `;
      return;
    }
    
    dictList.innerHTML = '';
    customDict.sort().forEach((word) => {
      const item = document.createElement('div');
      item.className = 'url-item';
      item.innerHTML = `
        <span class="url-text">${word}</span>
        <button class="btn-remove" data-word="${word}">Remove</button>
      `;
      dictList.appendChild(item);
    });
    
    // Add remove button listeners
    document.querySelectorAll('#dictionaryList .btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const wordToRemove = e.target.getAttribute('data-word');
        removeFromDictionary(wordToRemove);
      });
    });
  });
}

// Remove word from dictionary
function removeFromDictionary(word) {
  chrome.storage.sync.get(['customDictionary'], (result) => {
    let customDict = result.customDictionary || [];
    customDict = customDict.filter(w => w !== word);
    
    chrome.storage.sync.set({ customDictionary: customDict }, () => {
      loadDictionary();
      
      // Notify content script to recheck
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'dictionaryUpdated' });
        }
      });
    });
  });
}
