# TeamFocus Desktop – Packaging & Distribution

## Build installers

From the `desktop` directory:

```bash
yarn install
yarn make
```

Outputs are in `out/` (e.g. `out/make/squirrel.windows/x64/TeamFocus Setup 1.0.0.exe` on Windows, `out/make/dmg/x64/TeamFocus-1.0.0.dmg` on macOS).

## Troubleshooting

**If `yarn make` fails** (e.g. during "Preparing native dependencies" or "Finalizing package"):

1. **Get the full error** – run with debug logging:
   - Windows (PowerShell): `$env:DEBUG="electron-forge:*"; yarn make`
   - Windows (CMD): `set DEBUG=electron-forge:* && yarn make`

2. **Common causes on Windows:**
   - **Path with spaces** – move the project to a path without spaces (e.g. `D:\TeamFocus`).
   - **Build tools** – native modules (`screenshot-desktop`, `active-win`) need Visual Studio Build Tools. Install "Desktop development with C++" workload.
   - **Node version** – use Node 18 or 20 LTS.

3. **Try packaging only** (skip installer creation):
   ```bash
   yarn package
   ```
   If this succeeds, the failure is in the Squirrel maker, not native modules.

## App icons

Place `assets/teamfocus.ico` (Windows) and `assets/teamfocus.icns` (macOS) in the `assets/` folder. The build uses them for installers. If either is missing, it falls back to `assets/teamfocus.png`.

## Metadata

- **package.json:** `name`, `version`, `description`, `author`, `productName`, `executableName` are used by the packager and makers.
- **forge.config.js:** Packager and maker options (icons, Windows metadata, DMG name, etc.).

## Code signing (optional)

- **Windows:** Set env vars before `yarn make`:
  - `WIN_CERTIFICATE_FILE` – path to `.pfx`
  - `WIN_CERTIFICATE_PASSWORD` – certificate password  
  Configured in `forge.config.js` for the Squirrel maker.

- **macOS:** Set env vars for notarization:
  - `APPLE_ID` – Apple ID email
  - `APPLE_TEAM_ID` – Team ID
  - `APPLE_APP_SPECIFIC_PASSWORD` – app-specific password  
  Configured in `forge.config.js` under `packagerConfig.osxNotarize`.

## Auto-updater (optional)

Electron Forge does not configure an auto-updater by default. To add updates:

1. Use a release server (e.g. GitHub Releases or your own) that serves Squirrel-compatible updates (Windows) or a custom update endpoint.
2. Integrate [electron-updater](https://www.electron.build/auto-update) or Squirrel’s update logic in the main process and expose a “Check for updates” action (e.g. from the Help menu).

See [Electron Forge – Auto Update](https://www.electronforge.io/advanced/auto-update) for more.
