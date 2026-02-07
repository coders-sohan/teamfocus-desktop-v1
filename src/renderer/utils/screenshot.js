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
        console.error("[screenshot] captureScreen error:", err);
        var msg =
          err && err.message
            ? err.message
            : "Screenshot capture failed.";
        var userMsg =
          msg.toLowerCase().indexOf("permission") !== -1 ||
          msg.toLowerCase().indexOf("denied") !== -1 ||
          msg.toLowerCase().indexOf("access") !== -1
            ? "Screen capture was denied. Please allow screen recording in System Settings (macOS) or display permissions (Windows), then try again."
            : "Screenshot capture failed. If this persists, check screen recording permissions in system settings.";
        if (
          typeof window !== "undefined" &&
          window.dispatchEvent &&
          typeof window.CustomEvent === "function"
        ) {
          window.dispatchEvent(
            new window.CustomEvent("teamfocus-screenshot-error", {
              detail: { message: userMsg, error: err },
            })
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
