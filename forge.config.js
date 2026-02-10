const path = require("path");
const fs = require("fs");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

const assetsDir = path.join(__dirname, "assets");
const iconPng = path.join(assetsDir, "teamfocus.png");
const iconIco = path.join(assetsDir, "teamfocus.ico");
const iconIcns = path.join(assetsDir, "teamfocus.icns");

const hasIco = fs.existsSync(iconIco);
const hasIcns = fs.existsSync(iconIcns);

// Optional signing config (no process.env). Create signing.config.js when you have certificates; see docs/PACKAGING.md.
const signingPath = path.join(__dirname, "signing.config.js");
let signing = {};
if (fs.existsSync(signingPath)) {
  try {
    signing = require(signingPath);
  } catch (e) {
    console.warn("[forge] signing.config.js load failed:", e.message);
  }
}

module.exports = {
  packagerConfig: {
    asar: true,
    // Unpack entire screenshot-desktop so win32 .bat/.manifest are available when packaged (ENOENT fix)
    asarUnpack: ["**/node_modules/screenshot-desktop/**"],
    // Exclude other platforms' native bindings when building for Windows so signtool doesn't try to sign them
    ignore: (path) => {
      if (path.includes("active-win") && (path.includes("darwin") || path.includes("linux"))) return true;
      return false;
    },
    name: "TeamFocus",
    executableName: "teamfocus",
    icon: hasIcns ? iconIcns : hasIco ? iconIco : iconPng,
    appCopyright: "Copyright (C) RISOSI",
    appCategoryType: "public.app-category.productivity",
    win32Metadata: {
      CompanyName: "RISOSI",
      FileDescription: "TeamFocus - Time & activity tracking for remote teams",
      ProductName: "TeamFocus",
      InternalName: "TeamFocus",
    },
    ...(process.platform === "darwin" && {
      osxSign: {},
      ...(signing.appleId && {
        osxNotarize: {
          teamId: signing.appleTeamId,
          appleId: signing.appleId,
          appleIdPassword: signing.appleAppSpecificPassword,
        },
      }),
    }),
  },
  rebuildConfig: {
    force: true,
  },
  makers: [
    // Windows: Squirrel maker (official @electron-forge package)
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "TeamFocus",
        setupIcon: hasIco ? iconIco : iconPng,
        authors: "RISOSI",
        description: "TeamFocus Desktop App - Work tracking and screenshot capture for team members",
        exe: "teamfocus.exe",
        certificateFile: signing.winCertificateFile || undefined,
        certificatePassword: signing.winCertificatePassword || undefined,
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
      config: {},
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        name: "TeamFocus",
        icon: hasIcns ? iconIcns : iconPng,
        overwrite: true,
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          bin: "teamfocus",
          maintainer: "RISOSI",
          homepage: "https://risosi.com",
          description: "TeamFocus - Time & activity tracking for remote teams",
        },
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        options: {
          bin: "teamfocus",
          maintainer: "RISOSI",
          homepage: "https://risosi.com",
          description: "TeamFocus - Time & activity tracking for remote teams",
        },
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
