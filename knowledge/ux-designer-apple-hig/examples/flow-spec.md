# Worked example: Scanner flow spec (Wren)

The kind of spec Wren hands to Sable and the frontend engineer. Each line traces to an HIG rule in `../docs/`.

## Flow: 3 steps, one primary action each
| Step | Screen | Primary action | Secondary | Done when |
|---|---|---|---|---|
| 1 Capture | Home / Library | **Scan** (opens choice: Upload photo · Use camera · Try a sample) | Library cards | an image is loaded |
| 2 Adjust | Adjust | **Save scan** | Retake · mode toggle Color / Gray / B&W · drag the corners | user saves |
| 3 Library | Library | **Scan** | open, rename, delete, Reset app data | scan appears at top |

HIG Writing: start flows with clear language and end with "Done"-style confirmation. After saving, show a toast **"Saved to Library"** with **Open** and no timer-only dismissal (HIG Accessibility: minimize time-boxed UI).

## States (every screen)
| State | What the user sees | Rule |
|---|---|---|
| Loading OpenCV (first visit ~3 MB) | Library and Upload stay usable. Pill "Loading scanner…" with a spinner. Scan button shows "Getting ready…" and is disabled | HIG Loading: show something ASAP and let people do other things |
| Ready | Pill "✓ Ready" | color + icon + text |
| Working | Pill "Working…". Only the Save button is disabled, with a busy indicator | never block the whole page |
| No page found | Corners at the image edges. Message: "Couldn't find the page edges. Drag the corners to fit the page." | error says how to fix it |
| Empty library | "No scans yet." + "Scan a receipt, letter or page. It stays on this device." + **Try a sample** button | HIG Writing: give a next step on blank screens |
| Camera denied | "Camera access is off. You can upload a photo instead." + **Upload photo** | offer an alternative path |
| Storage full | "Storage is full. Delete some scans to save new ones." + **Open Library** | explain and give a next step |
| Load failed / stuck | "The scanner didn't load." + **Try again** · **Troubleshooting** | no blame, no "Oops" |

## Copy deck (sentence case everywhere, verbs on buttons, no "we", no "my")
| Element | Text |
|---|---|
| Primary buttons | Scan · Save scan · Try a sample · Upload photo · Use camera |
| Secondary | Retake · Rename · Delete · Cancel |
| Destructive confirm | Title "Delete all scans?" · Body "This removes every scan and setting stored in this browser. You can't undo this." · Buttons **Delete all** / Cancel |
| Mode toggle | Color · Gray · B&W |
| Status pill | Loading scanner… · Ready · Working… · Scanner error |
| Links | "Learn how scanning works" (not "Click here") |

## Accessibility acceptance
- Every control is reachable by **Tab**, activates with **Enter/Space**, and has a visible focus ring.
- Corner handles are focusable `role="slider"`-style buttons with labels like "Top-left corner, x 120, y 80". **Arrow keys move 1 px, Shift+Arrow 10 px.** This is the alternative to dragging (HIG: offer alternatives to gestures).
- Status pill is `role="status"` / `aria-live="polite"`.
- Delete all asks for confirmation (HIG: confirm actions that are hard to recover from).
- Targets ≥ 44×44 px, text ≥ 11px, contrast ≥ 4.5:1, works at 200 % zoom, respects reduced motion.
