# tabmgmt

Chrome extension for managing tabs - close/gather same-domain tabs and move tabs with keyboard shortcuts.

## Features

- Close all tabs matching the active tab's domain
- Gather same-domain tabs around the active tab
- Gather all tabs by domain across the window
- Move tabs left/right with keyboard shortcuts
- Move tabs to start/end of tab bar
- Works with pinned tabs

## Installation

### Chrome Web Store
https://chromewebstore.google.com/detail/manage-tabs-by-domain-mv3/gobmdjdemnlkgfcgmhmmojgaebfediog

### Manual
1. Clone this repository
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Close same-domain tabs | Cmd+Shift+X | Ctrl+Shift+X |
| Gather around active | Cmd+Shift+A | Ctrl+Shift+A |
| Gather all by domain | Cmd+Shift+L | Ctrl+Shift+L |
| Move tab left | Ctrl+Cmd+Left | Alt+Shift+Left |
| Move tab right | Ctrl+Cmd+Right | Alt+Shift+Right |
| Move tab to start | Ctrl+Cmd+Up | Alt+Shift+Up |
| Move tab to end | Ctrl+Cmd+Down | Alt+Shift+Down |

Customize shortcuts at `chrome://extensions/shortcuts`

## Build

```bash
make build version=x.x.x
```

## License

MIT
