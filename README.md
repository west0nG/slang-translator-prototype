# Slang translator prototype

An interactive classroom prototype for reading English slang in a simulated Twitter thread. When a supported phrase scrolls into view, a desktop pop-up or simulated mobile Dynamic Island shows its meaning in plain English. Use the bookmark icon to save the phrase, then open the language book to review it with flashcards.

Open `public/index.html` in a browser, or run `python3 -m http.server 8000 --directory public` from the repository root. Saved phrases and learning progress are stored in the current browser.

Vercel serves the static files in `public/` and deploys updates from `main`.
