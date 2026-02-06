(function () {
  const electronAPI = window.electronAPI;

  function getActiveWindow() {
    if (!electronAPI || !electronAPI.getActiveWindow) {
      return Promise.resolve(null);
    }
    return electronAPI.getActiveWindow().catch(function (err) {
      console.error("[windowDetection] getActiveWindow error:", err);
      return null;
    });
  }

  window.windowDetection = {
    getActiveWindow: getActiveWindow,
  };
})();
