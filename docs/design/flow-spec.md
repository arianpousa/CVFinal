# Flow spec: Smart Document Scanner (Wren, ux-designer-apple-hig)

Adapted from the tested reference `knowledge/ux-designer-apple-hig/examples/flow-spec.md` for the real app. Each rule traces to Apple HIG: [Loading](https://developer.apple.com/design/human-interface-guidelines/loading) · [Writing](https://developer.apple.com/design/human-interface-guidelines/writing) · [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).

## One screen, three steps (one primary action each)
| Step | Region | Primary action | Secondary | Done when |
|---|---|---|---|---|
| 1 Capture | "Scan a page" card | **Upload photo** | Use camera · Try a sample (Receipt / Letter) | an image is loaded |
| 2 Adjust | "Adjust" card (photo with 4 corner handles + live preview) | **Save scan** | Retake · mode Color / Gray / B&W · drag or arrow-key the corners · name field | user saves |
| 3 Library | "Library" grid | open a scan | Rename · Delete · Download · Reset app data | the new scan is first in the grid |

After saving: the status line says **"Saved to Library."** and focus moves to the new card. No timer-only toasts (HIG Accessibility: avoid time-boxed UI).

Opening a scan shows a dialog with **Original** and **Scan** side by side, Download buttons for both, Rename, Delete, Close (Esc closes).

## States (the status pill, top bar: color + icon + text, `role="status"`)
| State | Pill | What else the user sees | Rule |
|---|---|---|---|
| Loading OpenCV (first visit ~3.4 MB compressed) | ⏳ "Loading scanner…" | Upload, camera and samples stay usable; a chosen photo waits and is scanned the moment the scanner is ready ("The scanner is still loading. Your photo will be scanned in a moment.") Library works. | HIG Loading: show content ASAP, let people do other things |
| Ready | ✓ "Ready" | — | |
| Working | ◌ "Working…" | Only **Save scan** and the mode toggle are disabled (`aria-busy` on the adjust card). Page scrolls, corners still move. | never block the whole page |
| Done | ✓ "Ready" + message "Saved to Library." | the new card is focused | end flows with a clear confirmation |
| No page found | ✓ "Ready" + message "Couldn't find the page edges. Drag the corners to fit the page." | corners sit at the photo edges | errors say how to fix them |
| Scanner error (load failed / stuck) | ⚠ "Scanner error" | Banner: "The scanner didn't load. Check your connection, then try again." **Try again** · **Troubleshooting** (link to How it works → Troubleshooting) | no blame, no "Oops" |
| Empty library | — | "No scans yet." "Scan a receipt, letter or page. It stays on this device." **Try a sample** | next step on blank screens |
| Camera denied / missing | — | "Camera access is off. You can upload a photo instead." **Upload photo** | offer an alternative path |
| Storage full | — | Banner: "Storage is full. Delete some scans to save new ones." | explain + next step |
| Update waiting (onblocked) | — | Banner: "Close other tabs of this app to finish updating." | tell people what to do |
| Outdated tab (onversionchange) | — | Banner: "This app was updated in another tab. Reload to keep going." **Reload** | |
| Storage closed unexpectedly (onclose) | — | Banner: "Saved scans are unavailable. Reload the page." **Reload** | |

## Copy deck (sentence case, verbs on buttons, no "we", no "my")
| Element | Text |
|---|---|
| Primary | Upload photo · Save scan |
| Secondary | Use camera · Take photo · Cancel · Try a sample · Receipt · Letter · Retake · Rename · Delete · Download scan · Download original · Close |
| Mode toggle | Color · Gray · B&W (B&W default) |
| Destructive confirm | Title "Delete all scans?" · Body "This removes every scan and setting stored in this browser. You can't undo this." · **Delete all** / Cancel |
| Reset entry point | "Reset app data" (footer, always visible, works even while the scanner is loading or broken) |
| Links | "How it works" · "Resources" (top bar and footer); never "click here" |

## Accessibility acceptance (checked by tests/e2e/a11y.e2e.cjs)
- Every control is reachable with **Tab**, works with **Enter/Space**, and has a visible focus ring.
- Corner handles are buttons labelled "Top-left corner, x 120, y 80". **Arrow keys move 1 px, Shift+Arrow 10 px** (alternative to dragging).
- Status pill is `role="status"` / `aria-live="polite"`; messages use a second polite live region.
- Delete all asks for confirmation (HIG: confirm hard-to-undo actions). Dialogs trap focus via `<dialog>` and close with Esc.
- Targets ≥ 44×44 px, text ≥ 11 px, contrast ≥ 4.5:1, usable at 200 % zoom, respects Reduce Motion / Reduce Transparency.
