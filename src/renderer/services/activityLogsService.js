(function () {
  const api = window.apiClient;
  if (!api) {
    throw new Error('apiClient must be loaded before activityLogsService');
  }

  function getDomainFromUrl(url) {
    if (!url || typeof url !== "string") return "";
    try {
      var u = new URL(url);
      return u.hostname || "";
    } catch (e) {
      return "";
    }
  }

  function buildFormData(screenshotBlob, options) {
    options = options || {};
    var formData = new FormData();
    var filename = options.filename || "screenshot.png";
    formData.append("screenshot", screenshotBlob, filename);
    formData.append("appName", options.appName != null ? String(options.appName) : "");
    formData.append("windowTitle", options.windowTitle != null ? String(options.windowTitle) : "");
    formData.append("domain", options.domain != null ? String(options.domain) : "");
    formData.append("timestamp", (options.timestamp instanceof Date ? options.timestamp : new Date()).toISOString());
    return formData;
  }

  function uploadActivityLog(formData) {
    return api.request("/activity-logs", {
      method: "POST",
      body: formData,
    });
  }

  function uploadFromCapture(screenshotBlob, activeWindowInfo) {
    var appName = "";
    var windowTitle = "";
    var domain = "";
    if (activeWindowInfo) {
      appName = activeWindowInfo.appName != null ? String(activeWindowInfo.appName) : "";
      windowTitle = activeWindowInfo.windowTitle != null ? String(activeWindowInfo.windowTitle) : "";
      domain = getDomainFromUrl(activeWindowInfo.url || "");
    }
    var formData = buildFormData(screenshotBlob, {
      appName: appName,
      windowTitle: windowTitle,
      domain: domain,
      timestamp: new Date(),
    });
    return uploadActivityLog(formData);
  }

  window.activityLogsService = {
    buildFormData: buildFormData,
    uploadActivityLog: uploadActivityLog,
    uploadFromCapture: uploadFromCapture,
  };
})();
