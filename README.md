# Jim's Language Tool - Enhanced Edition

A Chrome extension that provides professional grammar and spell checking using LanguageTool's free API - **only on URLs you specify**.

## ✨ NEW: Inline Error Highlighting

Errors now appear **directly in your text** with colored underlines:
- 🔴 **Red wavy underline** = Spelling errors
- 🔵 **Blue wavy underline** = Grammar errors
- Click any underlined error for instant fixes!

## Features

✅ **Inline highlighting** - See errors directly in your text  
✅ **Professional checking** using LanguageTool API  
✅ **URL-specific** - only runs on domains you whitelist  
✅ **Works with Substack, Medium, and all contenteditable editors**  
✅ **Works with Quill editor** and other rich text editors  
✅ **Double-click any word** for instant synonym suggestions  
✅ **Custom dictionary** - add words to ignore (names, jargon, etc.)  
✅ **Ignore individual errors** - dismiss false positives instantly  
✅ **Click-to-fix** - click green buttons to instantly fix errors  
✅ **Free** - uses LanguageTool's public API  

## Installation

1. Download and extract the extension folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `jims-language-tool` folder
6. The extension is now installed!

## How to Use

### Adding URLs

1. **Click the extension icon** in your toolbar
2. **Add the current page**: Click "Add Current Page" button
3. **Or add manually**: Type a domain (e.g., `substack.com`) and click "Add"

### Checking Your Text

1. Go to any allowed website
2. Start typing in text fields or contenteditable areas
3. Wait 1 second after you stop typing
4. Errors appear with **colored underlines**:
   - 🔴 **Red wavy** = Spelling error
   - 🔵 **Blue wavy** = Grammar error
5. **Click any underlined error** to see fix suggestions
6. **Click any green button** to apply that fix instantly
7. **Click "🚫 Ignore"** to dismiss a false positive without fixing it
8. **Click "📖 Get Synonyms"** for alternative words
9. **Double-click any word** (even correct ones!) for synonyms

## What It Checks

LanguageTool checks for:

- **Spelling mistakes** (typos, misspellings)
- **Grammar errors** (subject-verb agreement, tense, etc.)
- **Style issues** (wordiness, passive voice)
- **Punctuation problems**
- **Commonly confused words** (their/there/they're)
- **And much more!**

## Example Errors

Try typing these to test:

**Spelling:**
- "I recieve alot of emails" → receive, a lot
- "Its definately wierd" → It's, definitely, weird

**Grammar:**
- "Me and him went there" → He and I
- "We was happy" → were
- "I seen them yesterday" → saw
- "should of been" → should have

## Where It Works

### Fully Supported (with inline highlighting):
- ✅ **Substack** editor
- ✅ **Medium** editor  
- ✅ **Gmail** compose
- ✅ **Google Docs** (basic support)
- ✅ **Notion** pages
- ✅ **Quill** editors
- ✅ **TinyMCE** editors
- ✅ **CKEditor**
- ✅ Any contenteditable element

### Basic Support (border indicator only):
- ⚠️ Standard text inputs
- ⚠️ Textareas

## Managing Allowed URLs

- **View all URLs**: Click the extension icon
- **Remove a URL**: Click "Remove" next to any URL in the list
- **Status indicator**: Shows if checking is active on current page

## Custom Dictionary & Ignore

**Add to Dictionary** (permanent):
1. Click on any spelling error
2. Click "➕ Add to Dictionary"
3. That word will never be flagged again
4. View all dictionary words in the extension popup
5. Remove words anytime from the popup

**Ignore** (temporary - for this session):
1. Click on any error (spelling or grammar)
2. Click "🚫 Ignore" 
3. The error disappears immediately
4. It may reappear if you retype or after a page refresh
5. Perfect for dismissing false positives!

## Technical Details

### How Inline Highlighting Works
- Creates `<span>` elements around errors in contenteditable fields
- Preserves cursor position during checking
- Merges text nodes efficiently
- Removes highlights when errors are fixed

### Supported Elements
- Standard text inputs (`<input type="text">`)
- Email inputs (`<input type="email">`)
- Textareas (`<textarea>`)
- **Rich text editors** (contenteditable divs) ⭐
- **Quill editor** (automatically detected)
- **Any contenteditable element** ⭐

### API Usage
- Uses LanguageTool's **free public API**
- No API key required
- Rate limits apply (don't spam the API)
- 1-second delay after typing before checking

### Privacy
- Text is sent to LanguageTool's servers for checking
- No data is stored by this extension
- URL preferences stored locally in Chrome

## Troubleshooting

**Not seeing underlines?**
1. Make sure you've added the current domain to allowed URLs
2. Wait 1 second after typing
3. Check console (F12) for error messages
4. Refresh the page after adding a URL
5. Make sure you're in a contenteditable field

**Underlines disappear when I type?**
- This is normal! The extension rechecks after you stop typing for 1 second
- Old highlights are removed and new ones appear

**Cursor jumps around?**
- The extension tries to preserve cursor position
- If issues persist, try typing more slowly
- Report bugs with specific sites/editors

**API errors?**
- You may have hit the rate limit (wait a minute)
- Check your internet connection
- LanguageTool's API might be down temporarily

**Extension not loading?**
1. Go to `chrome://extensions/`
2. Find "Jim's Language Tool"
3. Click the refresh icon
4. Check for any error messages

## File Structure

```
jims-language-tool/
├── manifest.json       # Extension configuration
├── popup.html          # Popup interface
├── popup.js            # Popup logic
├── content.js          # Grammar checking + inline highlighting ⭐
├── content.css         # Styling for highlights ⭐
├── background.js       # Background service worker
├── icon16.png          # Extension icons
├── icon48.png
├── icon128.png
└── README.md           # This file
```

## About LanguageTool

LanguageTool is an open-source grammar checking tool that supports 30+ languages. This extension uses their free public API endpoint. For heavier usage, consider:

- Creating a free LanguageTool account for higher limits
- Self-hosting LanguageTool
- Upgrading to LanguageTool Premium

Learn more at: https://languagetool.org/

## Tips for Best Results

1. **Wait** - Let the 1-second delay complete before expecting results
2. **Write complete sentences** - LanguageTool works best with proper sentences
3. **Click underlined errors** - Much faster than clicking the field background
4. **Use dictionary feature** - Add proper nouns, technical terms, etc.
5. **Try synonyms** - Double-click words for alternatives

## What's New in This Version

✨ **Inline error highlighting** - Errors now show directly in text  
✨ **Contenteditable support** - Works perfectly with Substack, Medium, etc.  
✨ **Click individual errors** - Click any underlined word for instant fixes  
✨ **Ignore button** - Dismiss false positives with one click  
✨ **Better cursor handling** - Cursor stays where you expect  
✨ **Visual distinction** - Red for spelling, blue for grammar  
✨ **Hover effects** - Highlights brighten on hover  

## Known Limitations

- Inline highlighting only works in contenteditable fields
- Standard textareas still use border indicator
- Some complex rich text editors may have issues
- Cursor position may jump occasionally in edge cases
- Rate limits on free API (20 requests/minute)

## Future Improvements

Possible enhancements:
- Support for more languages
- Better textarea highlighting
- Configurable delay time
- Click-outside-to-dismiss popups
- Export/import dictionary
- Statistics dashboard

## Credits

Created for Jim  
Enhanced with inline highlighting  
Powered by LanguageTool API  
Made with ❤️ for better writing

---

**Enjoy cleaner, more professional writing!** 📝
