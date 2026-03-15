// ═══════════════════════════════════════════════
//  Jim's Language Tool — popup.js
// ═══════════════════════════════════════════════

const API_URL = 'https://api.languagetool.org/v2/check';
const DATAMUSE  = 'https://api.datamuse.com/words';

// ── Tab switching ──────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── Constrain panel height to available space ──
// Chrome caps popups at the screen height; measure the fixed header
// and give all remaining room to the scrollable panel.
function fitPanelHeight() {
  const header    = document.querySelector('.header');
  const headerH   = header ? header.offsetHeight : 80;
  const available = Math.min(window.innerHeight, 600) - headerH - 4;
  document.querySelectorAll('.panel').forEach(p => {
    p.style.maxHeight = available + 'px';
  });
}

fitPanelHeight();
window.addEventListener('resize', fitPanelHeight);

// ════════════════════════════════════════════════
//  SITES PANEL  (unchanged logic, tidied)
// ════════════════════════════════════════════════

// Get current tab URL and display it
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    try {
      const url    = new URL(tabs[0].url);
      const domain = url.hostname;
      document.getElementById('currentUrl').textContent = domain;

      chrome.storage.sync.get(['allowedUrls'], (result) => {
        const allowed = result.allowedUrls || [];
        showStatus(allowed.some(a => domain.includes(a) || a.includes(domain)));
      });
    } catch (_) {
      document.getElementById('currentUrl').textContent = 'N/A';
      showStatus(false);
    }
  }
});

function showStatus(isAllowed) {
  const card = document.getElementById('statusCard');
  const text = document.getElementById('statusText');
  card.className = `status-card ${isAllowed ? 'active' : 'inactive'}`;
  text.textContent = isAllowed ? '✓ Grammar checking is ACTIVE'
                               : '✗ Grammar checking is INACTIVE';
}

function loadUrls() {
  chrome.storage.sync.get(['allowedUrls'], (result) => {
    const urlList = document.getElementById('urlList');
    const urls    = result.allowedUrls || [];

    if (urls.length === 0) {
      urlList.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div>No URLs added yet.<br>Add URLs to enable checking.</div>`;
      return;
    }

    urlList.innerHTML = '';
    urls.forEach(url => {
      const item = document.createElement('div');
      item.className = 'url-item';
      item.innerHTML = `<span class="url-text">${url}</span><button class="btn-remove" data-url="${url}">Remove</button>`;
      urlList.appendChild(item);
    });

    urlList.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', () => removeUrl(btn.dataset.url));
    });
  });
}

document.getElementById('addCurrent').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      try { addUrl(new URL(tabs[0].url).hostname); } catch (_) {}
    }
  });
});

document.getElementById('addUrl').addEventListener('click', () => {
  const input = document.getElementById('urlInput');
  const raw   = input.value.trim();
  if (raw) {
    addUrl(raw.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    input.value = '';
  }
});

document.getElementById('urlInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') document.getElementById('addUrl').click();
});

function addUrl(url) {
  chrome.storage.sync.get(['allowedUrls'], (result) => {
    const urls = result.allowedUrls || [];
    if (urls.includes(url)) return;
    urls.push(url);
    chrome.storage.sync.set({ allowedUrls: urls }, () => {
      loadUrls();
      notifyContentScript(urls);
    });
  });
}

function removeUrl(url) {
  chrome.storage.sync.get(['allowedUrls'], (result) => {
    const urls = (result.allowedUrls || []).filter(u => u !== url);
    chrome.storage.sync.set({ allowedUrls: urls }, () => {
      loadUrls();
      notifyContentScript(urls);
    });
  });
}

function notifyContentScript(updatedUrls) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'urlsUpdated' }).catch(() => {});
      try {
        const domain = new URL(tabs[0].url).hostname;
        showStatus(updatedUrls.some(a => domain.includes(a) || a.includes(domain)));
      } catch (_) {}
    }
  });
}

function loadDictionary() {
  chrome.storage.sync.get(['customDictionary'], (result) => {
    const dictList = document.getElementById('dictionaryList');
    const dict     = result.customDictionary || [];

    if (dict.length === 0) {
      dictList.innerHTML = `<div class="empty-state"><div class="empty-icon">📖</div>No custom words yet.<br>Add words to ignore them in spell check.</div>`;
      return;
    }

    dictList.innerHTML = '';
    [...dict].sort().forEach(word => {
      const item = document.createElement('div');
      item.className = 'url-item';
      item.innerHTML = `<span class="url-text">${word}</span><button class="btn-remove" data-word="${word}">Remove</button>`;
      dictList.appendChild(item);
    });

    dictList.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', () => removeFromDictionary(btn.dataset.word));
    });
  });
}

function removeFromDictionary(word) {
  chrome.storage.sync.get(['customDictionary'], (result) => {
    const dict = (result.customDictionary || []).filter(w => w !== word);
    chrome.storage.sync.set({ customDictionary: dict }, () => {
      loadDictionary();
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'dictionaryUpdated' }).catch(() => {});
      });
    });
  });
}

loadUrls();
loadDictionary();


// ════════════════════════════════════════════════
//  CHECK TEXT PANEL
// ════════════════════════════════════════════════

const textarea      = document.getElementById('check-input');
const hlLayer       = document.getElementById('highlight-layer');
const statusEl      = document.getElementById('check-status');
const errorList     = document.getElementById('error-list');
const btnCheck      = document.getElementById('btn-check');
const btnCopy       = document.getElementById('btn-copy');
const btnClear      = document.getElementById('btn-clear');

// Active errors array — each entry: { offset, length, message, replacements, isSpelling, ignored }
let activeErrors = [];

// ── Highlight mirror ───────────────────────────
// Keeps the <div> layer in sync with the textarea's content and scroll position.

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function rebuildHighlightLayer() {
  const text = textarea.value;

  if (activeErrors.length === 0) {
    hlLayer.innerHTML = escapeHtml(text)
      // Preserve trailing newline so layer height matches textarea
      .replace(/\n$/, '\n\u200B');
    return;
  }

  // Sort errors by offset ascending, skip ignored ones
  const visible = activeErrors
    .filter(e => !e.ignored)
    .sort((a, b) => a.offset - b.offset);

  let html = '';
  let cursor = 0;

  for (const err of visible) {
    if (err.offset < cursor) continue; // overlapping — skip
    // Plain text before this error
    html += escapeHtml(text.slice(cursor, err.offset));
    // Highlighted span
    const cls  = err.isSpelling ? 'hl-spell' : 'hl-grammar';
    const word = escapeHtml(text.slice(err.offset, err.offset + err.length));
    html += `<span class="${cls}">${word}</span>`;
    cursor = err.offset + err.length;
  }

  html += escapeHtml(text.slice(cursor)).replace(/\n$/, '\n\u200B');
  hlLayer.innerHTML = html;
}

// Sync scroll between textarea and highlight layer
textarea.addEventListener('scroll', () => {
  hlLayer.scrollTop  = textarea.scrollTop;
  hlLayer.scrollLeft = textarea.scrollLeft;
});

// Live rebuild as user types (clears old results)
textarea.addEventListener('input', () => {
  // If there were results showing, clear them so user knows a recheck is needed
  if (activeErrors.length > 0) {
    activeErrors = [];
    rebuildHighlightLayer();
    errorList.innerHTML = '';
    setStatus('', '');
  } else {
    rebuildHighlightLayer();
  }
});

// ── API helpers ────────────────────────────────

async function getCustomDictionary() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['customDictionary'], result => {
      resolve(result.customDictionary || []);
    });
  });
}

async function addWordToDictionary(word) {
  const dict = await getCustomDictionary();
  const lc   = word.toLowerCase();
  if (!dict.includes(lc)) {
    dict.push(lc);
    await new Promise(r => chrome.storage.sync.set({ customDictionary: dict }, r));
    loadDictionary(); // refresh Sites panel list
  }
}

async function callLanguageTool(text) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ text, language: 'en-US' })
  });
  return response.json();
}

async function getSynonyms(word) {
  try {
    const res  = await fetch(`${DATAMUSE}?rel_syn=${encodeURIComponent(word)}&max=6`);
    const data = await res.json();
    return data.map(d => d.word);
  } catch (_) {
    return [];
  }
}

// ── Status helper ──────────────────────────────

function setStatus(msg, cls) {
  statusEl.textContent  = msg;
  statusEl.className    = cls;
}

// ── Check button ───────────────────────────────

btnCheck.addEventListener('click', async () => {
  const text = textarea.value.trim();
  if (!text) return;

  btnCheck.disabled = true;
  btnCheck.textContent = '⏳ Checking…';
  setStatus('Calling LanguageTool…', 'loading');
  errorList.innerHTML = '';
  activeErrors = [];

  try {
    const data   = await callLanguageTool(text);
    const dict   = await getCustomDictionary();
    const rawErrors = data.matches || [];

    // Filter out custom-dictionary words
    const filtered = rawErrors.filter(m => {
      const word = text.substring(m.offset, m.offset + m.length).toLowerCase();
      return !dict.includes(word);
    });

    activeErrors = filtered.map(m => ({
      offset:      m.offset,
      length:      m.length,
      message:     m.shortMessage || m.message,
      replacements: m.replacements.slice(0, 4).map(r => r.value),
      isSpelling:  m.rule.issueType === 'misspelling' || m.rule.category.id === 'TYPOS',
      ignored:     false
    }));

    rebuildHighlightLayer();

    if (activeErrors.length === 0) {
      setStatus('✓ No issues found!', 'clean');
    } else {
      setStatus(`${activeErrors.length} issue${activeErrors.length !== 1 ? 's' : ''} found — click an error to expand`, 'has-errors');
      renderErrorCards();
    }

  } catch (err) {
    setStatus('⚠ API error — check your connection', 'has-errors');
    console.error('[JLT popup] Check failed:', err);
  } finally {
    btnCheck.disabled = false;
    btnCheck.textContent = '🔍 Check';
  }
});

// ── Render error cards ─────────────────────────

function renderErrorCards() {
  errorList.innerHTML = '';

  const visible = activeErrors.filter(e => !e.ignored);
  if (visible.length === 0) {
    setStatus('✓ All issues resolved!', 'clean');
    rebuildHighlightLayer();
    return;
  }

  visible.forEach((err, visIdx) => {
    const origIdx = activeErrors.indexOf(err);
    const word    = textarea.value.substring(err.offset, err.offset + err.length);
    const cls     = err.isSpelling ? 'spell' : 'grammar';
    const color   = err.isSpelling ? '#e74c3c' : '#3498db';
    const label   = err.isSpelling ? 'SPELLING' : 'GRAMMAR';

    const card = document.createElement('div');
    card.className = `err-card ${cls}`;
    card.dataset.origIdx = origIdx;

    card.innerHTML = `
      <div class="err-card-header">
        <span class="err-badge" style="background:${color}">${label}</span>
        <span class="err-word">"${escapeHtml(word)}"</span>
      </div>
      <div class="err-msg">${escapeHtml(err.message)}</div>
      <div class="err-body">
        <div class="fix-row" id="fixes-${origIdx}"></div>
        <div class="syn-results" id="syn-area-${origIdx}" style="display:none"></div>
      </div>
    `;

    // Toggle open/close on card click
    card.addEventListener('click', (e) => {
      // Don't toggle if clicking a button inside
      if (e.target.tagName === 'BUTTON') return;
      card.classList.toggle('open');
      if (card.classList.contains('open')) buildCardBody(card, err, origIdx, word);
    });

    errorList.appendChild(card);
  });
}

function buildCardBody(card, err, origIdx, word) {
  const fixRow = card.querySelector(`#fixes-${origIdx}`);
  if (fixRow.dataset.built) return; // already built
  fixRow.dataset.built = '1';

  // Fix buttons
  err.replacements.forEach(rep => {
    const btn = document.createElement('button');
    btn.className = 'btn-fix';
    btn.textContent = rep;
    btn.title = `Replace with "${rep}"`;
    btn.addEventListener('click', () => applyFix(origIdx, rep));
    fixRow.appendChild(btn);
  });

  // Add to dictionary (spelling only)
  if (err.isSpelling) {
    const dictBtn = document.createElement('button');
    dictBtn.className = 'btn-dict';
    dictBtn.textContent = '➕ Add to Dictionary';
    dictBtn.addEventListener('click', async () => {
      await addWordToDictionary(word);
      dictBtn.textContent = '✓ Added';
      dictBtn.disabled = true;
      ignoreError(origIdx);
    });
    fixRow.appendChild(dictBtn);
  }

  // Ignore button
  const ignBtn = document.createElement('button');
  ignBtn.className = 'btn-ignore-err';
  ignBtn.textContent = '🚫 Ignore';
  ignBtn.addEventListener('click', () => ignoreError(origIdx));
  fixRow.appendChild(ignBtn);

  // Synonyms button
  const synBtn = document.createElement('button');
  synBtn.className = 'btn-syn';
  synBtn.textContent = '📖 Synonyms';
  synBtn.addEventListener('click', async () => {
    synBtn.disabled = true;
    synBtn.textContent = '⏳ Loading…';
    const synonyms = await getSynonyms(word);
    renderSynonyms(card, origIdx, word, synonyms, synBtn);
  });
  fixRow.appendChild(synBtn);
}

function renderSynonyms(card, origIdx, word, synonyms, triggerBtn) {
  const area = card.querySelector(`#syn-area-${origIdx}`);
  area.style.display = 'block';

  if (synonyms.length === 0) {
    area.innerHTML = '<span class="no-syn">No synonyms found</span>';
    triggerBtn.style.display = 'none';
    return;
  }

  const label = document.createElement('div');
  label.className = 'syn-label';
  label.textContent = `Synonyms for "${word}"`;
  area.appendChild(label);

  const row = document.createElement('div');
  row.className = 'syn-row';

  synonyms.forEach(syn => {
    const btn = document.createElement('button');
    btn.className = 'btn-syn-replace';
    btn.textContent = syn;
    btn.addEventListener('click', () => applyFix(origIdx, syn));
    row.appendChild(btn);
  });

  area.appendChild(row);
  triggerBtn.style.display = 'none';
}

// ── Apply a fix ────────────────────────────────

function applyFix(origIdx, replacement) {
  const err  = activeErrors[origIdx];
  if (!err) return;

  const text    = textarea.value;
  const before  = text.slice(0, err.offset);
  const after   = text.slice(err.offset + err.length);
  const newText = before + replacement + after;

  // Adjust offsets of all subsequent errors
  const delta = replacement.length - err.length;
  activeErrors.forEach((e, i) => {
    if (i !== origIdx && e.offset > err.offset) e.offset += delta;
  });

  // Mark this one done
  activeErrors[origIdx].ignored = true;

  textarea.value = newText;
  rebuildHighlightLayer();
  renderErrorCards();

  const remaining = activeErrors.filter(e => !e.ignored).length;
  if (remaining === 0) {
    setStatus('✓ All issues resolved!', 'clean');
  } else {
    setStatus(`${remaining} issue${remaining !== 1 ? 's' : ''} remaining`, 'has-errors');
  }
}

// ── Ignore an error ────────────────────────────

function ignoreError(origIdx) {
  if (!activeErrors[origIdx]) return;
  activeErrors[origIdx].ignored = true;
  rebuildHighlightLayer();
  renderErrorCards();

  const remaining = activeErrors.filter(e => !e.ignored).length;
  if (remaining === 0) {
    setStatus('✓ All issues resolved!', 'clean');
  } else {
    setStatus(`${remaining} issue${remaining !== 1 ? 's' : ''} remaining`, 'has-errors');
  }
}

// ── Copy button ────────────────────────────────

btnCopy.addEventListener('click', () => {
  if (!textarea.value) return;
  navigator.clipboard.writeText(textarea.value).then(() => {
    const orig = btnCopy.textContent;
    btnCopy.textContent = '✓ Copied!';
    btnCopy.classList.add('copied');
    setTimeout(() => {
      btnCopy.textContent = orig;
      btnCopy.classList.remove('copied');
    }, 1800);
  });
});

// ── Clear button ───────────────────────────────

btnClear.addEventListener('click', () => {
  textarea.value = '';
  activeErrors   = [];
  hlLayer.innerHTML = '';
  errorList.innerHTML = '';
  setStatus('', '');
});
