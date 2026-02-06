(function () {
  var TOAST_DURATION_MS = 5000;
  var hideTimeoutId = null;

  function getOrCreateContainer() {
    var id = "teamfocus-toast-container";
    var el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("div");
    el.id = id;
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    el.className = "teamfocus-toast-container";
    document.body.appendChild(el);
    return el;
  }

  function getOrCreateToast() {
    var container = getOrCreateContainer();
    var toast = container.querySelector(".teamfocus-toast");
    if (toast) return toast;
    toast = document.createElement("div");
    toast.className = "teamfocus-toast";
    toast.setAttribute("role", "alert");
    container.appendChild(toast);
    return toast;
  }

  function showToast(message, type) {
    type = type || "info";
    var toast = getOrCreateToast();
    var container = getOrCreateContainer();
    toast.textContent = message || "";
    toast.className = "teamfocus-toast teamfocus-toast-" + type;
    container.classList.add("teamfocus-toast-visible");
    toast.hidden = !message;

    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }
    if (message) {
      hideTimeoutId = setTimeout(function () {
        hideToast();
        hideTimeoutId = null;
      }, TOAST_DURATION_MS);
    }
  }

  function hideToast() {
    var container = document.getElementById("teamfocus-toast-container");
    if (container) {
      container.classList.remove("teamfocus-toast-visible");
      var toast = container.querySelector(".teamfocus-toast");
      if (toast) toast.hidden = true;
    }
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }
  }

  function showError(message) {
    showToast(message, "error");
  }

  function showSuccess(message) {
    showToast(message, "success");
  }

  window.teamfocusNotifications = {
    showToast: showToast,
    hideToast: hideToast,
    showError: showError,
    showSuccess: showSuccess,
  };
})();
