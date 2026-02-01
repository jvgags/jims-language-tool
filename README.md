# Jim's Language Tool

A Chrome extension that provides professional grammar and spell checking using LanguageTool's free API - **only on URLs you specify**.

## Features

✓ **Professional checking** using LanguageTool API  
✓ **URL-specific** - only runs on domains you whitelist  
✓ **Works with Quill editor** and other rich text editors  
✓ **Double-click any word** for instant synonym suggestions  
✓ **Custom dictionary** - add words to ignore (names, jargon, etc.)  
✓ **Synonym suggestions** for errors too  
✓ **Red border** on fields with errors  
✓ **Click field** to see errors and suggestions  
✓ **Click-to-fix** - click green buttons to instantly fix errors  
✓ **Free** - uses LanguageTool's public API  

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
3. **Or add manually**: Type a domain (e.g., `docs.google.com`) and click "Add"

### Checking Your Text

1. Go to any allowed website
2. Start typing in text fields or textareas
3. Wait 1 second after you stop typing
4. Fields with errors will get a **red bottom border**
5. **Click the field** to see all errors and suggestions
6. **Click any green button** to fix that error instantly
7. **Click "📖 Get Synonyms"** to see synonym alternatives for any error
8. **Double-click any word** (even correct ones!) to get synonyms instantly

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

## Managing Allowed URLs

- **View all URLs**: Click the extension icon
- **Remove a URL**: Click "Remove" next to any URL in the list
- **Status indicator**: Shows if checking is active on current page

### Technical Details

### Supported Elements
- Standard text inputs (`<input type="text">`)
- Email inputs (`<input type="email">`)
- Textareas (`<textarea>`)
- **Rich text editors** (contenteditable divs)
- **Quill editor** (automatically detected via .ql-editor class)
- **Other editors** (TinyMCE, CKEditor, etc.)

### API Usage
- Uses LanguageTool's **free public API**
- No API key required
- Rate limits apply (don't spam the API)
- 1-second delay after typing before checking

### Privacy
- Text is sent to LanguageTool's servers for checking
- No data is stored by this extension
- URL preferences stored locally in Chrome

### Limitations
- Free API has rate limits
- Requires internet connection
- 1-second delay before checking
- Only works on standard text inputs and textareas

## Troubleshooting

**Not seeing underlines?**
1. Make sure you've added the current domain to allowed URLs
2. Wait 1 second after typing
3. Check console (F12) for error messages
4. Refresh the page after adding a URL

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
├── content.js          # Grammar checking logic
├── content.css         # Styling for highlights
├── background.js       # Background service worker
├── icon16.png          # Extension icons
├── icon48.png
├── icon128.png
├── test-page.html      # Test page
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
3. **Don't overload** - Check reasonable amounts of text at once
4. **Reload page** - If checking stops working, refresh the page

## Future Improvements

Possible enhancements:
- Add more languages
- Configurable delay time
- Personal dictionary
- Click-to-fix suggestions
- Statistics on errors caught

## Credits

Created for Jim  
Powered by LanguageTool API  
Made with ❤️ for better writing

---

**Enjoy cleaner, more professional writing!** 📝
