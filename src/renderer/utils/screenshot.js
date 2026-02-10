(function () {
  const electronAPI = window.electronAPI;

  function getDisplays() {
    if (!electronAPI || !electronAPI.getDisplays) {
      return Promise.reject(new Error("getDisplays not available"));
    }
    return electronAPI.getDisplays();
  }

  function captureScreen(displayIndexOrOptions) {
    if (!electronAPI || !electronAPI.captureScreen) {
      return Promise.reject(
        new Error(
          "captureScreen not available. Install: yarn add screenshot-desktop",
        ),
      );
    }
    const options =
      typeof displayIndexOrOptions === "number"
        ? { displayIndex: displayIndexOrOptions }
        : typeof displayIndexOrOptions === "object" && displayIndexOrOptions != null
          ? displayIndexOrOptions
          : {};
    return electronAPI
      .captureScreen(options)
      .then(function (buffer) {
        if (!buffer) return null;
        var blob =
          buffer instanceof Blob ? buffer : new Blob([new Uint8Array(buffer)]);
        return blob;
      })
      .catch(function (err) {
        // unified error -> user-friendly message
        var msg = err && err.message ? err.message : "Screenshot capture failed.";

        // Prefer showing the real reason (ENOENT, etc.) + a short action hint.
        var lower = String(msg).toLowerCase();
        var isMissingFile = lower.indexOf("enoent") !== -1 || lower.indexOf("no such file") !== -1;
        var looksLikePermission =
          lower.indexOf("permission") !== -1 ||
          lower.indexOf("denied") !== -1 ||
          lower.indexOf("access") !== -1;

        var userMsg;
        if (msg.indexOf("On Windows:") !== -1 || msg.indexOf("On macOS:") !== -1) {
          userMsg = msg;
        } else if (isMissingFile) {
          userMsg =
            "Screenshot capture failed because a required file is missing. Please reinstall the desktop app, then try again.";
        } else if (looksLikePermission) {
          userMsg =
            "TeamFocus can't capture screenshots yet. Please allow screen recording in system settings, then try again.";
        } else {
          userMsg = "Screenshot capture failed. Please try again.";
        }

        if (
          typeof window !== "undefined" &&
          window.dispatchEvent &&
          typeof window.CustomEvent === "function"
        ) {
          window.dispatchEvent(
            new window.CustomEvent("teamfocus-screenshot-error", {
              detail: { message: userMsg, error: err },
            }),
          );
        }
        return null;
      });
  }

  window.screenshotUtil = {
    getDisplays: getDisplays,
    captureScreen: captureScreen,
  };
})();
