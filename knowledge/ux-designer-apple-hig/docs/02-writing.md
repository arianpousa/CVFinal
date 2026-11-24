# Writing UI text (Apple HIG)

**Source:** https://developer.apple.com/design/human-interface-guidelines/writing (updated Dec 16, 2025) · Apple Style Guide: https://help.apple.com/applestyleguide/#/

## Getting started
- **Determine your voice** (who you're talking to, the vocabulary they know) and keep a list of common terms.
- **Match tone to context.** Be serious for errors and light for success.
- **Be clear.** Check every word, use fewer words, and read it aloud.
- **Write for everyone.** Use plain language and avoid jargon and gendered terms, with accessibility and localization in mind.

## Best practices
- Put the **most important information first**. Split complex ideas across screens.
- **Be action oriented.** Label buttons and links with verbs. "Send" beats "Let's do it!". Avoid "Click here" in favor of descriptive link text, which matters for screen-reader users.
- **Build language patterns** and stay consistent.
- Choose a **capitalization style** per element type (title case is formal, sentence case casual) and apply it consistently.
- In multi-step flows, start with "Get Started", continue with "Continue"/"Next", and finish with "Done", consistently.
- **Use possessive pronouns sparingly** ("Favorites", not "Your Favorites"). **Avoid "we"**: "Unable to load content" is clearer than "We're having trouble loading this content."
- Describe gestures correctly per device ("tap" on touch, "click" with a mouse).
- **Empty states:** give clear next steps and a button where possible. Don't put crucial info there, since empty states are temporary.
- **Error messages:**
  - Show them close to the problem.
  - Don't blame the user.
  - Say how to fix it: "Choose a password with at least 8 characters" rather than "That password is too short".
  - Skip "oops!" and "uh-oh".
- Settings labels: describe what happens when the setting is on. Link directly to settings instead of describing where they are.
- Text fields: use hint text with an example, show errors right next to the field, and give instructions instead of scolding ("Use only letters for your name").

## Our voice
Calm, plain and brief. We say "scan", "page" and "library", never "Mat", "IndexedDB" or "contour" in the main UI (those words belong on the How it works page). Sentence case everywhere. Verbs on buttons. No "we", no "my". The full copy deck is in `examples/flow-spec.md`.
