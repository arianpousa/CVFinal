# How it works (worked example of the page copy)

This is plain-language copy for a classmate, with every claim linked to a source. Numbers come only from recorded test results.

## 1. Finding the page: OpenCV.js
The app turns your photo gray, softens it slightly to hide paper texture, and traces strong edges with the **Canny** edge detector. It then looks for the largest outline that simplifies to **four corners**: that's the page. ([Canny](https://docs.opencv.org/5.x/d7/de1/tutorial_js_canny.html), [contours](https://docs.opencv.org/4.x/d5/daa/tutorial_js_contours_begin.html), [approxPolyDP](https://docs.opencv.org/4.x/dc/dcf/tutorial_js_contour_features.html))

## 2. Flattening it
Those four corners are mapped to a rectangle with a **perspective warp**, so a photo taken at an angle looks like it was scanned flat. ([Geometric transformations](https://docs.opencv.org/4.x/dd/d52/tutorial_js_geometric_transformations.html))

## 3. Making it crisp
**Adaptive thresholding** decides black or white for each small neighbourhood separately, so shadows across the page don't turn into black blotches. ([Thresholding](https://docs.opencv.org/4.x/d7/dd0/tutorial_js_thresholding.html))

## 4. Why it's fast and never freezes: WebAssembly in a Web Worker
OpenCV is written in C++. **OpenCV.js** is that same code compiled to **WebAssembly**, a compact binary format browsers run at near-native speed ([webassembly.org](https://webassembly.org/)). It runs inside a **Web Worker**, a background thread, so the page stays responsive while a scan is processed ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)). In testing, the page never paused for more than 22 ms across 21 scans.

## 5. Why nothing leaks
Images inside OpenCV.js live in WebAssembly memory that JavaScript's garbage collector can't free, so the app deletes every image buffer (`cv.Mat`) when it's done ([Using OpenCV.js](https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html)). In testing, memory stayed at 128 MiB after 200 scans.

## 6. Your library stays on your device: IndexedDB
Every scan is saved as an image file in **IndexedDB**, a database built into the browser, so the library is still there after a refresh. Nothing is uploaded ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)). **Reset app data** deletes it all. You can inspect it in Chrome DevTools under Application → IndexedDB ([Chrome DevTools](https://developer.chrome.com/docs/devtools/storage/indexeddb)).
