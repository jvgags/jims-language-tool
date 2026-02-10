// Jim's Language Tool - Enhanced with inline highlighting
let isActive = false;
let checkTimeout = null;
const CHECK_DELAY = 1000;
const API_URL = 'https://api.languagetool.org/v2/check';
const HIGHLIGHT_CLASS = 'jlt-error-highlight';
const SPELLING_CLASS = 'jlt-spelling-error';
const GRAMMAR_CLASS = 'jlt-grammar-error';

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

// Get synonyms from API
async function getSynonyms(word) {
  try {
    const response = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=5`);
    const data = await response.json();
    return data.map(item => item.word);
  } catch (err) {
    console.error('[Jim\'s Language Tool] Synonym API error:', err);
    return [];
  }
}

// Highlight errors in contenteditable elements
function highlightErrorsInContentEditable(element, errors, text) {
  console.log('[Jim\'s Language Tool] Highlighting errors in contenteditable');
  
  // Remove old highlights
  removeHighlights(element);
  
  if (!errors || errors.length === 0) {
    return;
  }
  
  // Save cursor position
  const selection = window.getSelection();
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const cursorOffset = range ? getTextOffset(element, range.startContainer, range.startOffset) : null;
  
  // Get all text nodes
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  // Build a map of character positions to text nodes
  let currentOffset = 0;
  const offsetMap = [];
  
  for (const textNode of textNodes) {
    const nodeText = textNode.textContent;
    offsetMap.push({
      node: textNode,
      startOffset: currentOffset,
      endOffset: currentOffset + nodeText.length,
      text: nodeText
    });
    currentOffset += nodeText.length;
  }
  
  // Apply highlights to errors (in reverse order to maintain offsets)
  const sortedErrors = [...errors].sort((a, b) => b.offset - a.offset);
  
  for (const error of sortedErrors) {
    const errorStart = error.offset;
    const errorEnd = error.offset + error.length;
    
    // Find which text nodes contain this error
    const relevantNodes = offsetMap.filter(nm => 
      !(nm.endOffset <= errorStart || nm.startOffset >= errorEnd)
    );
    
    if (relevantNodes.length === 0) continue;
    
    for (const nodeMap of relevantNodes) {
      const nodeStart = Math.max(0, errorStart - nodeMap.startOffset);
      const nodeEnd = Math.min(nodeMap.text.length, errorEnd - nodeMap.startOffset);
      
      if (nodeEnd <= nodeStart) continue;
      
      const textNode = nodeMap.node;
      const beforeText = textNode.textContent.substring(0, nodeStart);
      const errorText = textNode.textContent.substring(nodeStart, nodeEnd);
      const afterText = textNode.textContent.substring(nodeEnd);
      
      // Create highlight span
      const highlight = document.createElement('span');
      highlight.className = `${HIGHLIGHT_CLASS} ${error.isSpelling ? SPELLING_CLASS : GRAMMAR_CLASS}`;
      highlight.textContent = errorText;
      highlight.dataset.jltError = JSON.stringify({
        offset: error.offset,
        length: error.length,
        message: error.message,
        replacements: error.replacements,
        isSpelling: error.isSpelling
      });
      
      // Replace the text node with before + highlight + after
      const parent = textNode.parentNode;
      
      if (beforeText) {
        parent.insertBefore(document.createTextNode(beforeText), textNode);
      }
      
      parent.insertBefore(highlight, textNode);
      
      if (afterText) {
        parent.insertBefore(document.createTextNode(afterText), textNode);
      }
      
      parent.removeChild(textNode);
      
      // Update the node map for this change
      nodeMap.node = highlight;
    }
  }
  
  // Restore cursor position
  if (cursorOffset !== null) {
    try {
      restoreCursor(element, cursorOffset);
    } catch (e) {
      console.warn('[Jim\'s Language Tool] Could not restore cursor:', e);
    }
  }
}

// Get text offset of a position within an element
function getTextOffset(root, node, offset) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let currentOffset = 0;
  let currentNode;
  
  while (currentNode = walker.nextNode()) {
    if (currentNode === node) {
      return currentOffset + offset;
    }
    currentOffset += currentNode.textContent.length;
  }
  
  return currentOffset;
}

// Restore cursor to a text offset
function restoreCursor(element, offset) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let currentOffset = 0;
  let node;
  
  while (node = walker.nextNode()) {
    const nodeLength = node.textContent.length;
    if (currentOffset + nodeLength >= offset) {
      const range = document.createRange();
      const localOffset = Math.min(offset - currentOffset, nodeLength);
      range.setStart(node, localOffset);
      range.setEnd(node, localOffset);
      
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    currentOffset += nodeLength;
  }
}

// Remove all highlights from an element
function removeHighlights(element) {
  const highlights = element.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    if (parent) {
      // Replace highlight with its text content
      const textNode = document.createTextNode(highlight.textContent);
      parent.replaceChild(textNode, highlight);
      
      // Merge adjacent text nodes
      parent.normalize();
    }
  });
}

// Get plain text from contenteditable (without highlight spans)
function getPlainText(element) {
  const clone = element.cloneNode(true);
  // Remove all highlight spans
  clone.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(span => {
    span.replaceWith(span.textContent);
  });
  return clone.innerText || clone.textContent || '';
}

// Setup on an input
function setupElement(element) {
  if (!isActive) return;
  if (element.dataset.jltSetup) return;
  element.dataset.jltSetup = 'true';
  
  console.log('[Jim\'s Language Tool] Setting up element:', element.tagName, element.className, element.contentEditable);
  
  const isContentEditable = element.contentEditable === 'true' || element.classList.contains('ql-editor');
  const isQuill = element.classList.contains('ql-editor');
  
  console.log('[Jim\'s Language Tool] Is Quill:', isQuill, 'Is contentEditable:', isContentEditable);
  
  // Function to get text content
  const getText = () => {
    if (isContentEditable || isQuill) {
      return getPlainText(element);
    }
    return element.value || '';
  };
  
  // Function to set text content
  const setText = (newText) => {
    if (isQuill || isContentEditable) {
      // Remove highlights first
      removeHighlights(element);
      
      // Save cursor position before replacing
      const selection = window.getSelection();
      const hadFocus = document.activeElement === element;
      const cursorOffset = selection.rangeCount > 0 ? getTextOffset(element, selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset) : null;
      
      // Clear and set new text
      element.textContent = newText;
      
      // Restore cursor position
      if (hadFocus && cursorOffset !== null) {
        try {
          restoreCursor(element, Math.min(cursorOffset, newText.length));
          element.focus();
        } catch (e) {
          // If cursor restore fails, just focus the element
          element.focus();
        }
      }
      
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
      if (isContentEditable) {
        removeHighlights(element);
      }
      element.style.borderBottom = '';
      delete element.dataset.jltErrors;
      return;
    }
    
    const errors = await checkText(text);
    console.log('[Jim\'s Language Tool] Found', errors.length, 'errors');
    
    if (errors.length > 0) {
      element.style.borderBottom = '2px solid #e74c3c';
      element.dataset.jltErrors = JSON.stringify(errors);
      
      // Add inline highlights for contenteditable
      if (isContentEditable) {
        highlightErrorsInContentEditable(element, errors, text);
      }
    } else {
      element.style.borderBottom = '';
      delete element.dataset.jltErrors;
      
      if (isContentEditable) {
        removeHighlights(element);
      }
    }
  };
  
  // Listen for changes
  if (isContentEditable || isQuill) {
    element.addEventListener('input', () => {
      clearTimeout(checkTimeout);
      checkTimeout = setTimeout(checkAndHighlight, CHECK_DELAY);
    });
    
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
  
  // Click on highlighted error to show tooltip
  element.addEventListener('click', (e) => {
    // Check if clicked on a highlight
    let target = e.target;
    if (target.classList.contains(HIGHLIGHT_CLASS)) {
      const errorData = JSON.parse(target.dataset.jltError);
      showSingleErrorTooltip(target, errorData, getText, setText, e);
      e.stopPropagation();
      return;
    }
    
    // Otherwise show all errors
    if (element.dataset.jltErrors) {
      showTooltip(element, JSON.parse(element.dataset.jltErrors), getText, setText, e);
    }
  });
  
  // Add double-click handler for synonym lookup
  element.addEventListener('dblclick', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[Jim\'s Language Tool] Double-click detected');
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    console.log('[Jim\'s Language Tool] Selected text:', selectedText);
    
    if (selectedText) {
      const synonyms = await getSynonyms(selectedText);
      
      if (synonyms.length > 0) {
        showSynonymPopup(e, selectedText, synonyms, element, getText, setText);
      }
    }
  });
}

// Show tooltip for a single highlighted error
function showSingleErrorTooltip(highlight, error, getText, setText, clickEvent) {
  document.querySelectorAll('.jlt-tooltip').forEach(t => t.remove());
  
  const tooltip = document.createElement('div');
  tooltip.className = 'jlt-tooltip';
  
  const color = error.isSpelling ? '#e74c3c' : '#3498db';
  const type = error.isSpelling ? 'SPELLING' : 'GRAMMAR';
  const context = highlight.textContent;
  
  let html = `
    <div class="jlt-item" style="border-left: 3px solid ${color}">
      <div class="jlt-type" style="background: ${color}">${type}</div>
      <div class="jlt-context">"${context}"</div>
      <div class="jlt-message">${error.message}</div>
  `;
  
  if (error.replacements && error.replacements.length > 0) {
    html += '<div class="jlt-suggestions">';
    error.replacements.forEach(replacement => {
      html += `<button class="jlt-btn jlt-fix-btn" data-replacement="${escapeHtml(replacement)}">${escapeHtml(replacement)}</button>`;
    });
    html += '</div>';
  }
  
  if (error.isSpelling) {
    html += `<button class="jlt-btn jlt-dict-btn" data-word="${escapeHtml(context)}" style="background: #f39c12; margin-top: 8px;">➕ Add to Dictionary</button>`;
  }
  
  html += `<button class="jlt-btn jlt-ignore-btn" data-word="${escapeHtml(context)}" style="background: #95a5a6; margin-top: 8px;">🚫 Ignore</button>`;
  html += `<button class="jlt-btn jlt-synonym-btn" data-word="${escapeHtml(context)}" style="background: #9b59b6; margin-top: 8px;">📖 Get Synonyms</button>`;
  html += `<div class="jlt-synonym-list" id="synonyms-single"></div>`;
  html += '</div>';
  
  tooltip.innerHTML = html;
  document.body.appendChild(tooltip);
  
  // Position tooltip
  const rect = highlight.getBoundingClientRect();
  tooltip.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  tooltip.style.left = (rect.left + window.scrollX) + 'px';
  
  // Add click handlers for fix buttons
  tooltip.querySelectorAll('.jlt-fix-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const replacement = btn.dataset.replacement;
      highlight.textContent = replacement;
      
      // Remove highlight styling
      highlight.classList.remove(HIGHLIGHT_CLASS, SPELLING_CLASS, GRAMMAR_CLASS);
      const parent = highlight.parentNode;
      parent.replaceChild(document.createTextNode(replacement), highlight);
      parent.normalize();
      
      tooltip.remove();
      showSuccess(rect, 'Fixed!');
      
      // Trigger recheck
      const element = findRootEditableElement(parent);
      if (element) {
        setTimeout(() => element.dispatchEvent(new Event('input', { bubbles: true })), 100);
      }
    });
  });
  
  // Dictionary button handler
  tooltip.querySelectorAll('.jlt-dict-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const word = btn.dataset.word;
      await addToDictionary(word);
      
      btn.textContent = '✓ Added';
      btn.disabled = true;
      btn.style.background = '#27ae60';
      
      setTimeout(() => {
        highlight.classList.remove(HIGHLIGHT_CLASS, SPELLING_CLASS, GRAMMAR_CLASS);
        const parent = highlight.parentNode;
        parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
        parent.normalize();
        
        tooltip.remove();
        showSuccess(rect, `"${word}" added to dictionary!`);
        
        const element = findRootEditableElement(parent);
        if (element) {
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 500);
    });
  });
  
  // Ignore button handler
  tooltip.querySelectorAll('.jlt-ignore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      highlight.classList.remove(HIGHLIGHT_CLASS, SPELLING_CLASS, GRAMMAR_CLASS);
      const parent = highlight.parentNode;
      parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      parent.normalize();
      
      tooltip.remove();
      showSuccess(rect, 'Error ignored');
    });
  });
  
  // Synonym button handler
  tooltip.querySelectorAll('.jlt-synonym-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const word = btn.dataset.word;
      const synonymList = document.getElementById('synonyms-single');
      
      btn.textContent = '⏳ Loading...';
      btn.disabled = true;
      
      const synonyms = await getSynonyms(word);
      
      if (synonyms.length > 0) {
        let synsHtml = '<div class="jlt-synonym-header">Synonyms:</div><div class="jlt-suggestions">';
        synonyms.forEach(syn => {
          synsHtml += `<button class="jlt-btn jlt-syn-replace" data-replacement="${escapeHtml(syn)}" style="background: #9b59b6;">${escapeHtml(syn)}</button>`;
        });
        synsHtml += '</div>';
        synonymList.innerHTML = synsHtml;
        
        synonymList.querySelectorAll('.jlt-syn-replace').forEach(synBtn => {
          synBtn.addEventListener('click', () => {
            const replacement = synBtn.dataset.replacement;
            highlight.textContent = replacement;
            
            highlight.classList.remove(HIGHLIGHT_CLASS, SPELLING_CLASS, GRAMMAR_CLASS);
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(replacement), highlight);
            parent.normalize();
            
            tooltip.remove();
            showSuccess(rect, 'Replaced!');
            
            const element = findRootEditableElement(parent);
            if (element) {
              setTimeout(() => element.dispatchEvent(new Event('input', { bubbles: true })), 100);
            }
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
      if (!tooltip.contains(e.target) && e.target !== highlight) {
        tooltip.remove();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 100);
}

// Find the root editable element from a child node
function findRootEditableElement(node) {
  let current = node;
  while (current && current !== document.body) {
    if (current.contentEditable === 'true' || current.classList.contains('ql-editor')) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

// Show synonym popup
function showSynonymPopup(event, word, synonyms, element, getText, setText) {
  document.querySelectorAll('.jlt-synonym-popup').forEach(p => p.remove());
  
  const popup = document.createElement('div');
  popup.className = 'jlt-synonym-popup';
  
  let html = `<div class="jlt-header">Synonyms for "${word}"</div>`;
  html += '<div class="jlt-suggestions">';
  
  synonyms.forEach(syn => {
    html += `<button class="jlt-btn" data-synonym="${escapeHtml(syn)}">${escapeHtml(syn)}</button>`;
  });
  
  html += '</div>';
  popup.innerHTML = html;
  document.body.appendChild(popup);
  
  popup.style.top = (event.clientY + window.scrollY + 8) + 'px';
  popup.style.left = (event.clientX + window.scrollX) + 'px';
  
  popup.querySelectorAll('.jlt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const synonym = btn.dataset.synonym;
      
      // Get current text
      const currentText = getText();
      
      // Find the word in the text and replace it
      const wordRegex = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      const newText = currentText.replace(wordRegex, synonym);
      
      // Set the new text
      setText(newText);
      
      popup.remove();
      showSuccess({ bottom: event.clientY, left: event.clientX }, 'Replaced!');
      
      setTimeout(() => element.dispatchEvent(new Event('input', { bubbles: true })), 100);
    });
  });
  
  setTimeout(() => {
    const handler = (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 100);
}

// Show tooltip with all suggestions
function showTooltip(element, errors, getText, setText, clickEvent) {
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
    
    if (error.isSpelling) {
      html += `<button class="jlt-btn jlt-dict-btn" data-idx="${idx}" data-word="${escapeHtml(context)}" style="background: #f39c12; margin-top: 8px;">➕ Add to Dictionary</button>`;
    }
    
    html += `<button class="jlt-btn jlt-ignore-btn" data-idx="${idx}" style="background: #95a5a6; margin-top: 8px;">🚫 Ignore</button>`;
    html += `<button class="jlt-btn jlt-synonym-btn" data-idx="${idx}" data-word="${escapeHtml(context)}" style="background: #9b59b6; margin-top: 8px;">📖 Get Synonyms</button>`;
    html += `<div class="jlt-synonym-list" id="synonyms-${idx}"></div>`;
    
    html += '</div>';
  });
  
  tooltip.innerHTML = html;
  document.body.appendChild(tooltip);
  
  let rect;
  if (clickEvent) {
    rect = { bottom: clickEvent.clientY, left: clickEvent.clientX };
  } else {
    rect = element.getBoundingClientRect();
  }
  
  tooltip.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  tooltip.style.left = (rect.left + window.scrollX) + 'px';
  
  // Add click handlers for fix buttons
  tooltip.querySelectorAll('.jlt-fix-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const replacement = btn.dataset.replacement;
      const error = errors[idx];
      
      const currentText = getText();
      const newText = currentText.substring(0, error.offset) + replacement + currentText.substring(error.offset + error.length);
      setText(newText);
      
      element.dispatchEvent(new Event('input', { bubbles: true }));
      tooltip.remove();
      
      showSuccess(rect, 'Fixed!');
    });
  });
  
  // Dictionary button handlers
  tooltip.querySelectorAll('.jlt-dict-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const word = btn.dataset.word;
      await addToDictionary(word);
      
      btn.textContent = '✓ Added';
      btn.disabled = true;
      btn.style.background = '#27ae60';
      
      setTimeout(() => {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        tooltip.remove();
        showSuccess(rect, `"${word}" added to dictionary!`);
      }, 500);
    });
  });
  
  // Ignore button handlers
  tooltip.querySelectorAll('.jlt-ignore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const error = errors[idx];
      
      // For contenteditable, find and remove the highlight
      if (element.contentEditable === 'true' || element.classList.contains('ql-editor')) {
        const highlights = element.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
        highlights.forEach(highlight => {
          const errorData = JSON.parse(highlight.dataset.jltError);
          if (errorData.offset === error.offset && errorData.length === error.length) {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
          }
        });
      }
      
      // Remove this error from the list
      errors.splice(idx, 1);
      
      if (errors.length === 0) {
        element.style.borderBottom = '';
        delete element.dataset.jltErrors;
        tooltip.remove();
      } else {
        element.dataset.jltErrors = JSON.stringify(errors);
        // Refresh tooltip with remaining errors
        tooltip.remove();
        showTooltip(element, errors, getText, setText, clickEvent);
      }
      
      showSuccess(rect, 'Error ignored');
    });
  });
  
  // Synonym button handlers
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
    removeHighlights(el);
    delete el.dataset.jltSetup;
    delete el.dataset.jltErrors;
  });
  document.querySelectorAll('.jlt-tooltip, .jlt-synonym-popup').forEach(t => t.remove());
}

// Scan for inputs
function scanPage() {
  if (!isActive) return;
  
  const selectors = 'input[type="text"], input[type="email"], textarea, [contenteditable="true"]';
  document.querySelectorAll(selectors).forEach(setupElement);
  
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
    document.querySelectorAll('[data-jlt-setup]').forEach(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
});

checkIfAllowed();
