# Screenshot options (Win+PrtSc style – all monitors in one image)

## "Screenshot capture failed" — why it happens and how to fix

- **Windows**
  - **Permissions:** Windows can block screen capture. Go to **Settings > Privacy & security > Screen recording** (or **Graphics capture**) and ensure **TeamFocus** is allowed. After changing, restart the app.
  - **Packaged app:** The installer unpacks `screenshot-desktop`’s Windows batch file so it can run. If you built the app yourself, ensure `forge.config.js` includes `asarUnpack` for `**/node_modules/screenshot-desktop/lib/win32/**`.
- **macOS**
  - **Screen Recording:** Open **System Settings > Privacy & Security > Screen Recording** and add **TeamFocus**. Restart the app after enabling.

If the error persists, check the main process console (or run with DevTools) for the underlying error (e.g. permission denied, file not found).

## What Windows does

- **PrtSc** – Copies the entire screen to the clipboard (on many setups this is the *full virtual screen*, i.e. all monitors in one image).
- **Win + PrtSc** – Saves the same full-screen image to `Pictures\Screenshots` and may also put it on the clipboard (behavior can vary by Windows version).

So “Win+PrtSc style” = **one image containing all monitors** (virtual screen).

## Current stack: `screenshot-desktop`

- Captures **one display at a time** via `{ screen: 0 }`, `{ screen: 1 }`, etc.
- Has **no API** that returns the full virtual screen in a single image.
- `screenshot.all()` returns an **array** of buffers (one per display); to get one image you would have to **composite** them (e.g. with an image library), which we are not using.

So with the current setup we only get **primary monitor** (or one chosen display), not “all monitors in one”.

## Options that can give “all monitors in one”

### 1. Clipboard after simulated Print Screen (no compositing)

- **Idea:** Simulate **PrtSc** (or Win+PrtSc if it puts image on clipboard), then read the image from the clipboard in Electron.
- **Pros:** Same result as the user pressing the key; no need to composite; no sharp/extra image lib.
- **Cons:** Needs a way to **send the key** from the main process (e.g. `robotjs`, `nut.js`, or a small script), and a short delay before reading clipboard.
- **Electron:** In main process, after simulating the key and waiting ~200–500 ms, use `require('electron').clipboard.readImage()` and convert the `NativeImage` to a PNG buffer.

So **yes**, there is a solution in this style: “simulate PrtSc (or Win+PrtSc), then read from clipboard” – that’s the closest to “Win + PrtSc button type” without compositing.

### 2. Windows virtual screen API (native addon)

- **Idea:** Use Windows APIs: `GetSystemMetrics(SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN)` and `GetDC(NULL)` + `BitBlt` to capture the full virtual screen in one call.
- **Pros:** One capture call, no compositing, no clipboard, no key simulation.
- **Cons:** Requires a **native addon** or a small Windows-only helper (C++ or C#) and proper build/package for Electron (e.g. `electron-rebuild`). No widely used npm package was found that exposes exactly this in one call.

### 3. Electron `desktopCapturer`

- `desktopCapturer.getSources({ types: ['screen'] })` returns **one source per display**, not a single “entire desktop” stream.
- To get one image you would still have to capture each source and **composite** them (again needs an image library or canvas).

### 4. `node-screenshots`

- `Monitor.all()` + `captureImageSync()` per monitor gives **one image per monitor**.
- Again, **one combined image** would require compositing (e.g. by position using each monitor’s x, y, width, height).

## Summary

- **“Win + PrtSc button type”** = one image of the full virtual screen (all monitors).
- **Practical solutions without compositing:**
  1. **Clipboard approach:** Simulate PrtSc (or Win+PrtSc), then `clipboard.readImage()` in Electron (requires a key-simulation dependency or external script).
  2. **Native Windows:** Small native addon using virtual screen metrics + `BitBlt` to capture in one shot.

If you want to implement (1), the next step is to add a key-simulation dependency (e.g. `robotjs` or `nut.js`) in the main process, trigger PrtSc (or Win+PrtSc), wait briefly, then read the clipboard and return the image as a PNG buffer to the renderer.
