# SlapWin 👋🔊

SlapWin is a sleek, completely offline, Progressive Web App (PWA) that exactly replicates the SlapMac app experience, but runs beautifully on Windows laptops, tablets, and mobile devices.

It uses the `DeviceMotion` API (accelerometer/gyroscope) to detect physical shakes or slaps, responding instantly with procedurally generated sound effects mapped proportionally to the force of the slap.

## Features
- **Zero Dependencies:** Pure HTML5, CSS3, and Vanilla JavaScript.
- **100% Offline Capable:** Runs anywhere via Service Workers without external network requests or downloading heavy sound clips.
- **Procedural Audio Engine:** Utilizes the Web Audio API to synthesize 8 different sound packs on the fly.
- **Hidden Minimalist UI:** The UI is completely invisible unless invoked.
- **Customizable:** Adjust sensitivity, cooldown, volume, and sound packs.
- **PWA Ready:** Easily installable as a native-feeling app directly from the browser on Windows or mobile.

## Controls
- **Slap / Shake:** Hit or shake your device.
- **Simulate Slap:** Press `Spacebar`.
- **Open Settings Menu:**
  - Mouse: `Right-Click` anywhere.
  - Keyboard: `Ctrl + Shift + S`.
  - Touch: Quick Double-Tap.

## Local Development
Since the app relies on Service Workers and device sensors, it must be run on a local development server (not directly from `file://`).

1. Install `serve` globally via npm (if you haven't already):
   ```bash
   npm install -g serve
   ```
2. Run it in the directory:
   ```bash
   npx serve .
   ```
3. Open `http://localhost:3000` in your browser.

## Deployment to Render.com
SlapWin is optimized for a **free, single static web service** on [Render.com](https://render.com) utilizing their fast global CDN.

1. **Fork/Push to GitHub**: Create a repository and push this folder.
2. **New Static Site**: Go to the Render Dashboard -> `New` -> `Static Site`.
3. **Connect**: Connect your GitHub repository.
4. **Configuration**:
   - **Build Command**: Leave completely blank (none).
   - **Publish Directory**: Set to `./` (or the root if deployed from root).
5. **Deploy**: Render will auto-deploy the site and serve it globally. You can now visit your site and optionally add a custom domain!

## License
MIT License. Created by AI.
