# tabmgmt

Chrome extension for managing tabs — close/gather same-domain tabs and move tabs with keyboard shortcuts.

## Features

- Close all tabs matching the active tab's domain (with one-click **undo**); pinned and audible tabs are kept
- Gather same-domain tabs around the active tab
- Gather all tabs by domain across the window
- Move tabs left/right, to the start, or to the end
- Pinned tabs stay pinned: moves wrap inside their own region and never cross it
- Popup shows the active domain, the sibling count, and the live shortcut for each action

## Grouping rules

Tabs are grouped by **host**, with a leading `www.` removed:

| URLs | Same group? |
|------|-------------|
| `https://example.com/a`, `http://example.com/b`, `https://www.example.com/c` | yes |
| `https://sub.example.com`, `https://example.com` | no (`sub.example.com` is its own group) |

Non-web tabs (`chrome://`, `chrome-extension://`, `file://`, `about:`) are never grouped, never closed, and never moved by the gather commands.

## Installation

### Chrome Web Store

https://chromewebstore.google.com/detail/manage-tabs-by-domain-mv3/gobmdjdemnlkgfcgmhmmojgaebfediog

### Manual

1. Clone this repository
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## Keyboard Shortcuts

Chrome allows at most **4** shortcuts to be pre-assigned by an extension, so only these ship bound:

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Close same-domain tabs | Cmd+Shift+X | Ctrl+Shift+X |
| Gather around active | Cmd+Shift+A | Ctrl+Shift+A |
| Move tab left | Ctrl+Cmd+Left | Alt+Shift+Left |
| Move tab right | Ctrl+Cmd+Right | Alt+Shift+Right |

The remaining actions have no default binding — assign them yourself at `chrome://extensions/shortcuts`:

| Action | Command |
|--------|---------|
| Gather all by domain | `gather-tabs-all` |
| Move tab to start | `move-tab-start` |
| Move tab to end | `move-tab-end` |
| Undo last close | `undo-close` |

The popup shows the live binding next to each action; unassigned actions show no badge. Chrome may also leave a suggested binding unassigned if the combination is already taken.

## Undo

`Close same-domain tabs` remembers the batch in `chrome.storage.session` (in-memory, cleared when the browser closes) and exposes an **Undo close** button in the popup plus the undo shortcut. Tabs are reopened in their original window and position; background pages, unloaded tabs, and non-web URLs cannot be recreated.

In the popup you can also press `c` (close), `g` (gather), `a` (gather all), or `u` (undo).

## Architecture

| File | Role |
|------|------|
| `domains.js` | Pure grouping/ordering logic — no `chrome.*`, fully unit tested |
| `background.js` | Service worker: reads window state, applies computed order, close/undo bookkeeping |
| `popup.html` / `popup.js` | Popup UI and controller |

Rearrangements are computed as a target order and applied with the **minimum number** of `chrome.tabs.move` calls, so multi-tab moves do not thrash the tab strip. A failing move (tab closed mid-flight) is logged and skipped instead of aborting the whole operation.

## Development

```bash
make test     # unit tests for domains.js (node --test)
make build    # zip the extension at the manifest version
make build-version version=x.y.z
```

## License

MIT
