// Jim's Language Tool - Simple approach
let isActive = false;
let checkTimeout = null;
const CHECK_DELAY = 1000;
const API_URL = 'https://api.languagetool.org/v2/check';

console.log('[Jim\'s Language Tool] Loaded on:', window.location.hostname);

// Check if allowed
function checkIfAllowed() {
  const domain = window.location.hostname;
  console.log('[Jim\'s Language Tool] Checking domain:', domain);
  
  chrome.storage.sync.get(['allowedUrls'], (result) => {
    const allowedUrls = result.allowedUrls || [];
    console.log('[Jim\'s Language Tool] Allowed URLs:', allowedUrls);
    
    const isAllowed = allowedUrls.length > 0 && allowedUrls.some(url => domain.includes(url) || url.includes(domain));
    console.log('[Jim\'s Language Tool] Is allowed:', isAllowed);
    
    if (isAllowed && !isActive) {
      console.log('[Jim\'s Language Tool] Activating checker');
      activateChecker();
    } else if (!isAllowed && isActive) {
      console.log('[Jim\'s Language Tool] Deactivating checker');
      deactivateChecker();
    } else if (!isAllowed) {
      console.log('[Jim\'s Language Tool] Not activating - domain not in allowed list');
    }
  });
}

// Call LanguageTool API
async function checkText(text) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text, language: 'en-US' })
    });
    
    const data = await response.json();
    
    // Get custom dictionary
    const customDict = await getCustomDictionary();
    
    // Filter out words in custom dictionary
    const filteredMatches = data.matches.filter(m => {
      const errorWord = text.substring(m.offset, m.offset + m.length).toLowerCase();
      return !customDict.includes(errorWord);
    });
    
    return filteredMatches.map(m => ({
      offset: m.offset,
      length: m.length,
      message: m.shortMessage || m.message,
      replacements: m.replacements.slice(0, 3).map(r => r.value),
      isSpelling: m.rule.issueType === 'misspelling' || m.rule.category.id === 'TYPOS'
    }));
  } catch (err) {
    console.error('[Jim\'s Language Tool] API error:', err);
    return [];
  }
}

// Get custom dictionary from storage
async function getCustomDictionary() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['customDictionary'], (result) => {
      resolve(result.customDictionary || []);
    });
  });
}

// Add word to custom dictionary
async function addToDictionary(word) {
  const dict = await getCustomDictionary();
  const lowerWord = word.toLowerCase();
  
  if (!dict.includes(lowerWord)) {
    dict.push(lowerWord);
    chrome.storage.sync.set({ customDictionary: dict });
    console.log('[Jim\'s Language Tool] Added to dictionary:', lowerWord);
  }
}

// Remove word from custom dictionary
async function removeFromDictionary(word) {
  const dict = await getCustomDictionary();
  const lowerWord = word.toLowerCase();
  const filtered = dict.filter(w => w !== lowerWord);
  
  chrome.storage.sync.set({ customDictionary: filtered });
  console.log('[Jim\'s Language Tool] Removed from dictionary:', lowerWord);
}

// Get synonyms from API
async function getSynonyms(word) {
  try {
    // Using datamuse API (free, no key required)
    const response = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=5`);
    const data = await response.json();
    return data.map(item => item.word);
  } catch (err) {
    console.error('[Jim\'s Language Tool] Synonym API error:', err);
    return [];
  }
}

// Setup on an input
function setupElement(element) {
  if (!isActive) return; // Don't setup if not active
  if (element.dataset.jltSetup) return;
  element.dataset.jltSetup = 'true';
  
  console.log('[Jim\'s Language Tool] Setting up element:', element.tagName, element.className, element.contentEditable);
  
  const isContentEditable = element.contentEditable === 'true' || element.classList.contains('ql-editor');
  const isQuill = element.classList.contains('ql-editor');
  
  console.log('[Jim\'s Language Tool] Is Quill:', isQuill, 'Is contentEditable:', isContentEditable);
  
  // Add subtle indicator that element is tracked
  const originalBorder = element.style.border;
  element.style.transition = 'border 0.3s';
  element.style.borderColor = element.style.borderColor || '#ddd';
  
  // Flash green briefly to show it's active
  setTimeout(() => {
    const tempBorder = element.style.border;
    element.style.border = '2px solid #27ae60';
    setTimeout(() => {
      element.style.border = tempBorder;
    }, 500);
  }, 100);
  
  // Function to get text content
  const getText = () => {
    if (isContentEditable || isQuill) {
      // Use innerText to get plain text without HTML tags
      return element.innerText || element.textContent || '';
    }
    return element.value || '';
  };
  
  // Function to set text content
  const setText = (newText) => {
    if (isQuill || isContentEditable) {
      // For contenteditable/Quill, preserve structure but replace text
      element.innerText = newText;
      // Trigger Quill's change event if it's a Quill editor
      if (isQuill) {
        element.dispatchEvent(new Event('text-change', { bubbles: true }));
      }
    } else {
      element.value = newText;
    }
  };
  
  const checkAndHighlight = async () => {
    const text = getText();
    if (!text || text.length < 3) {
      element.style.borderBottom = '';
      delete element.dataset.jltErrors;
      return;
    }
    
    const errors = await checkText(text);
    console.log('[Jim\'s Language Tool] Found', errors.length, 'errors');
    
    if (errors.length > 0) {
      // Just add a border to indicate errors
      element.style.borderBottom = '2px solid #e74c3c';
      element.dataset.jltErrors = JSON.stringify(errors);
      element.dataset.jltGetText = 'true'; // Mark that we need special getText
    } else {
      element.style.borderBottom = '';
      delete element.dataset.jltErrors;
      delete element.dataset.jltGetText;
    }
  };
  
  // Listen for changes
  if (isContentEditable || isQuill) {
    // For contenteditable and Quill, listen to input events
    element.addEventListener('input', () => {
      clearTimeout(checkTimeout);
      checkTimeout = setTimeout(checkAndHighlight, CHECK_DELAY);
    });
    
    // Quill also fires text-change
    if (isQuill) {
      element.addEventListener('text-change', () => {
        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(checkAndHighlight, CHECK_DELAY);
      });
    }
  } else {
    element.addEventListener('input', () => {
      clearTimeout(checkTimeout);
      checkTimeout = setTimeout(checkAndHighlight, CHECK_DELAY);
    });
  }
  
  element.addEventListener('click', (e) => {
    if (element.dataset.jltErrors) {
      showTooltip(element, JSON.parse(element.dataset.jltErrors), getText, setText, e);
    }
  });
  
  // Add double-click handler for synonym lookup
  element.addEventListener('dblclick', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[Jim\'s Language Tool] Double-click detected');
    
    const text = getText();
    let selectedWord = '';
    let wordStart = 0;
    let wordEnd = 0;
    
    // On double-click, browser usually auto-selects the word
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    console.log('[Jim\'s Language Tool] Selected text:', selectedText);
    
    if (selectedText) {
      selectedWord = selectedText;
      // Find position in full text
      wordStart = text.indexOf(selectedText);
      if (wordStart === -1) {
        // Try case-insensitive
        const lowerText = text.toLowerCase();
        const lowerSelected = selectedText.toLowerCase();
        wordStart = lowerText.indexOf(lowerSelected);
      }
      wordEnd = wordStart + selectedText.length;
    }
    
    if (selectedWord && selectedWord.length > 1 && wordStart >= 0) {
      console.log('[Jim\'s Language Tool] Looking up synonyms for:', selectedWord);
      showSynonymPopup(element, selectedWord, wordStart, wordEnd, getText, setText);
    } else {
      console.log('[Jim\'s Language Tool] No valid word selected');
    }
  });
}

// Show synonym popup for double-clicked word
async function showSynonymPopup(element, word, wordStart, wordEnd, getText, setText) {
  // Remove old tooltips
  document.querySelectorAll('.jlt-tooltip', '.jlt-synonym-popup').forEach(t => t.remove());
  
  const popup = document.createElement('div');
  popup.className = 'jlt-synonym-popup';
  
  popup.innerHTML = `
    <div class="jlt-header">Synonyms for "${escapeHtml(word)}"</div>
    <div class="jlt-loading">⏳ Loading synonyms...</div>
  `;
  
  document.body.appendChild(popup);
  
  // Get position of the selected text, not the whole element
  let rect;
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    rect = range.getBoundingClientRect();
    console.log('[Jim\'s Language Tool] Using selection rect:', rect);
  } else {
    // Fallback to element position
    rect = element.getBoundingClientRect();
    console.log('[Jim\'s Language Tool] Using element rect:', rect);
  }
  
  popup.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  popup.style.left = (rect.left + window.scrollX) + 'px';
  
  // Fetch synonyms
  const synonyms = await getSynonyms(word);
  
  if (synonyms.length > 0) {
    let html = `<div class="jlt-header">Synonyms for "${escapeHtml(word)}"</div>`;
    html += '<div class="jlt-suggestions">';
    synonyms.forEach(syn => {
      html += `<button class="jlt-btn" style="background: #9b59b6;" data-replacement="${escapeHtml(syn)}">${escapeHtml(syn)}</button>`;
    });
    html += '</div>';
    popup.innerHTML = html;
    
    // Add click handlers
    popup.querySelectorAll('.jlt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const replacement = btn.dataset.replacement;
        const currentText = getText();
        const newText = currentText.substring(0, wordStart) + replacement + currentText.substring(wordEnd);
        setText(newText);
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        popup.remove();
        
        showSuccess(rect, 'Replaced!');
      });
    });
  } else {
    popup.innerHTML = `
      <div class="jlt-header">Synonyms for "${escapeHtml(word)}"</div>
      <div class="jlt-no-synonyms">No synonyms found for this word</div>
    `;
  }
  
  // Close on outside click
  setTimeout(() => {
    const handler = (e) => {
      if (!popup.contains(e.target) && e.target !== element) {
        popup.remove();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 100);
}

// Show tooltip with suggestions
function showTooltip(element, errors, getText, setText, clickEvent) {
  // Remove old tooltips
  document.querySelectorAll('.jlt-tooltip').forEach(t => t.remove());
  
  if (!errors || errors.length === 0) return;
  
  const text = getText();
  
  const tooltip = document.createElement('div');
  tooltip.className = 'jlt-tooltip';
  
  let html = `<div class="jlt-header">${errors.length} issue${errors.length > 1 ? 's' : ''} found</div>`;
  
  errors.slice(0, 5).forEach((error, idx) => {
    const color = error.isSpelling ? '#e74c3c' : '#3498db';
    const type = error.isSpelling ? 'SPELLING' : 'GRAMMAR';
    const context = text.substring(error.offset, error.offset + error.length);
    
    html += `
      <div class="jlt-item" style="border-left: 3px solid ${color}">
        <div class="jlt-type" style="background: ${color}">${type}</div>
        <div class="jlt-context">"${context}"</div>
        <div class="jlt-message">${error.message}</div>
    `;
    
    if (error.replacements.length > 0) {
      html += '<div class="jlt-suggestions">';
      error.replacements.forEach(replacement => {
        html += `<button class="jlt-btn jlt-fix-btn" data-idx="${idx}" data-replacement="${escapeHtml(replacement)}">${escapeHtml(replacement)}</button>`;
      });
      html += '</div>';
    }
    
    // Add dictionary button (only for spelling errors)
    if (error.isSpelling) {
      html += `<button class="jlt-btn jlt-dict-btn" data-idx="${idx}" data-word="${escapeHtml(context)}" style="background: #f39c12; margin-top: 8px;">➕ Add to Dictionary</button>`;
    }
    
    // Add synonym button
    html += `<button class="jlt-btn jlt-synonym-btn" data-idx="${idx}" data-word="${escapeHtml(context)}" style="background: #9b59b6; margin-top: 8px;">📖 Get Synonyms</button>`;
    html += `<div class="jlt-synonym-list" id="synonyms-${idx}"></div>`;
    
    html += '</div>';
  });
  
  tooltip.innerHTML = html;
  document.body.appendChild(tooltip);
  
  // Position tooltip - use click position if available
  let rect;
  if (clickEvent) {
    rect = {
      bottom: clickEvent.clientY,
      left: clickEvent.clientX
    };
    console.log('[Jim\'s Language Tool] Using click position:', clickEvent.clientX, clickEvent.clientY);
  } else {
    rect = element.getBoundingClientRect();
    console.log('[Jim\'s Language Tool] Using element rect');
  }
  
  tooltip.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  tooltip.style.left = (rect.left + window.scrollX) + 'px';
  
  // Add click handlers for fix buttons
  tooltip.querySelectorAll('.jlt-fix-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const replacement = btn.dataset.replacement;
      const error = errors[idx];
      
      // Replace text
      const currentText = getText();
      const newText = currentText.substring(0, error.offset) + replacement + currentText.substring(error.offset + error.length);
      setText(newText);
      
      // Trigger recheck
      element.dispatchEvent(new Event('input', { bubbles: true }));
      tooltip.remove();
      
      showSuccess(rect, 'Fixed!');
    });
  });
  
  // Add click handlers for dictionary buttons
  tooltip.querySelectorAll('.jlt-dict-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const word = btn.dataset.word;
      await addToDictionary(word);
      
      btn.textContent = '✓ Added';
      btn.disabled = true;
      btn.style.background = '#27ae60';
      
      // Recheck to remove this error
      setTimeout(() => {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        tooltip.remove();
        showSuccess(rect, `"${word}" added to dictionary!`);
      }, 500);
    });
  });
  
  // Add click handlers for synonym buttons
  tooltip.querySelectorAll('.jlt-synonym-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const word = btn.dataset.word;
      const synonymList = document.getElementById(`synonyms-${idx}`);
      
      btn.textContent = '⏳ Loading...';
      btn.disabled = true;
      
      const synonyms = await getSynonyms(word);
      
      if (synonyms.length > 0) {
        let synsHtml = '<div class="jlt-synonym-header">Synonyms:</div><div class="jlt-suggestions">';
        synonyms.forEach(syn => {
          synsHtml += `<button class="jlt-btn jlt-syn-replace" data-idx="${idx}" data-replacement="${escapeHtml(syn)}" style="background: #9b59b6;">${escapeHtml(syn)}</button>`;
        });
        synsHtml += '</div>';
        synonymList.innerHTML = synsHtml;
        
        // Add click handlers for synonym replacements
        synonymList.querySelectorAll('.jlt-syn-replace').forEach(synBtn => {
          synBtn.addEventListener('click', () => {
            const idx = parseInt(synBtn.dataset.idx);
            const replacement = synBtn.dataset.replacement;
            const error = errors[idx];
            
            const currentText = getText();
            const newText = currentText.substring(0, error.offset) + replacement + currentText.substring(error.offset + error.length);
            setText(newText);
            
            element.dispatchEvent(new Event('input', { bubbles: true }));
            tooltip.remove();
            
            showSuccess(rect, 'Replaced!');
          });
        });
        
        btn.style.display = 'none';
      } else {
        synonymList.innerHTML = '<div class="jlt-no-synonyms">No synonyms found</div>';
        btn.textContent = '📖 Get Synonyms';
        btn.disabled = false;
      }
    });
  });
  
  // Close on outside click
  setTimeout(() => {
    const handler = (e) => {
      if (!tooltip.contains(e.target) && e.target !== element) {
        tooltip.remove();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 100);
}

// Show success message
function showSuccess(rect, message) {
  const success = document.createElement('div');
  success.className = 'jlt-success';
  success.textContent = message;
  document.body.appendChild(success);
  success.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  success.style.left = (rect.left + window.scrollX) + 'px';
  setTimeout(() => success.remove(), 1500);
}

// Escape HTML for display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Activate
function activateChecker() {
  isActive = true;
  console.log('[Jim\'s Language Tool] Activated - scanning for elements');
  scanPage();
  
  // Scan more frequently to catch dynamically loaded editors
  setInterval(() => {
    if (isActive) {
      scanPage();
    }
  }, 2000);
}

// Deactivate
function deactivateChecker() {
  isActive = false;
  document.querySelectorAll('[data-jlt-setup]').forEach(el => {
    el.style.borderBottom = '';
    delete el.dataset.jltSetup;
    delete el.dataset.jltErrors;
  });
  document.querySelectorAll('.jlt-tooltip, .jlt-synonym-popup').forEach(t => t.remove());
}

// Scan for inputs
function scanPage() {
  if (!isActive) return;
  
  // Standard inputs
  const selectors = 'input[type="text"], input[type="email"], textarea, [contenteditable="true"]';
  document.querySelectorAll(selectors).forEach(setupElement);
  
  // Quill editors - look for .ql-editor elements
  document.querySelectorAll('.ql-editor').forEach(quillEditor => {
    if (!quillEditor.dataset.jltSetup) {
      console.log('[Jim\'s Language Tool] Found Quill editor');
      setupElement(quillEditor);
    }
  });
}

// Listen for updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'urlsUpdated') {
    checkIfAllowed();
  } else if (msg.action === 'dictionaryUpdated') {
    // Recheck all elements
    document.querySelectorAll('[data-jlt-setup]').forEach(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
});

checkIfAllowed();
