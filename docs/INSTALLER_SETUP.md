# Installer Setup - Quick Start

## What Was Fixed

✅ **Windows: Squirrel installer** (official Electron Forge maker)
✅ **Code signing support** - Optional signing.config.js (removes SmartScreen warning when signed)
✅ **Branding configured** - RISOSI publisher, TeamFocus icon

## Next Steps

### 1. Install Dependencies

```bash
cd desktop
yarn install
```

This will install dependencies including `@electron-forge/maker-squirrel` for Windows.

### 2. Build Installer

```bash
yarn make
```

Output: `out/make/squirrel.windows/x64/TeamFocus Setup 1.0.0.exe` (or similar)

### 3. Code Signing (To Remove SmartScreen Warning)

**No `process.env`** — use an optional `signing.config.js` in the desktop folder (see `docs/PACKAGING.md` for the format).

**Option A: Purchase Certificate** (Recommended for production)
- Buy from DigiCert, Sectigo, or GlobalSign (~$200-400/year)
- Export as `.pfx` file
- Create `signing.config.js` with `winCertificateFile` and `winCertificatePassword`, then run `yarn make`.

**Option B: Self-signed cert (script)** — Creates a certificate and `signing.config.js` with a strong random password. No Admin required.

From **CMD** (run from repo root or `desktop` folder):

```cmd
cd D:\RISOSI\TeamFocus\desktop
powershell -ExecutionPolicy Bypass -File create-signing-cert.ps1
```

From **PowerShell**:

```powershell
cd D:\RISOSI\TeamFocus\desktop
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\create-signing-cert.ps1
```

Then run `yarn make`. The script creates `certs/teamfocus-signing.pfx` and `signing.config.js`; both are gitignored. **Note:** Self-signed certs may still trigger a SmartScreen warning; a purchased cert reduces or removes it.

## What Changed

1. **`forge.config.js`**: Uses Squirrel maker for Windows; code signing via optional `signing.config.js` (see `docs/PACKAGING.md`)

## Installation Location

- **Default**: `%LOCALAPPDATA%\TeamFocus` (e.g., `C:\Users\Username\AppData\Local\TeamFocus`)
- Squirrel installs to the default location; users can move the app if needed

## Custom Installer UI with Logo

The installer:
- ✅ Shows your icon (`teamfocus.ico`)
- ✅ Shows "RISOSI" as publisher
- ✅ Shows "TeamFocus" as product name

For **fully custom installer screens**, consider `electron-builder` or see `docs/PACKAGING.md`.

## Testing

After building:
1. Run the installer: `out/make/squirrel.windows/x64/TeamFocus Setup 1.0.0.exe` (exact name may vary)
2. Check:
   - ✅ Installer shows your icon
   - ✅ Shows RISOSI as publisher
   - ✅ User can choose installation location
   - ✅ Installation completes successfully
3. For code signing: Right-click installer → Properties → Digital Signatures tab (should show certificate if signed)

## Troubleshooting

**"Unknown publisher" warning still appears**:
- You need a code signing certificate (see Step 3 above)
- Self-signed certificates still show warnings
- Certificate reputation builds over time (even with valid cert)

**Installer UI looks generic**:
- Squirrel uses a standard Windows installer UI; icon and metadata are applied automatically
- For custom screens, see `docs/PACKAGING.md` or use electron-builder
