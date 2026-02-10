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

  function getOrCreateScreenshotErrorCard() {
    var id = "teamfocus-screenshot-error-card";
    var el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("div");
    el.id = id;
    el.className = "teamfocus-screenshot-error-card";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-labelledby", "teamfocus-screenshot-error-title");
    el.setAttribute("aria-describedby", "teamfocus-screenshot-error-message");
    el.innerHTML =
      '<div class="teamfocus-screenshot-error-inner">' +
      '<div class="teamfocus-screenshot-error-icon" aria-hidden="true"><i class="fa-solid fa-camera-slash"></i></div>' +
      '<h3 id="teamfocus-screenshot-error-title" class="teamfocus-screenshot-error-title">Screenshot failed</h3>' +
      '<p id="teamfocus-screenshot-error-message" class="teamfocus-screenshot-error-message"></p>' +
      '<div class="teamfocus-screenshot-error-actions">' +
      '<button type="button" class="teamfocus-screenshot-error-btn-open" id="teamfocus-screenshot-error-open-settings">Open Privacy & security</button>' +
      '<button type="button" class="teamfocus-screenshot-error-btn-dismiss" id="teamfocus-screenshot-error-dismiss">Dismiss</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(el);
    var openBtn = el.querySelector("#teamfocus-screenshot-error-open-settings");
    var dismissBtn = el.querySelector("#teamfocus-screenshot-error-dismiss");
    if (openBtn) {
      openBtn.addEventListener("click", function () {
        if (window.electronAPI && window.electronAPI.openPrivacySettings) {
          window.electronAPI.openPrivacySettings();
        }
      });
    }
    if (dismissBtn) {
      dismissBtn.addEventListener("click", function () {
        hideScreenshotError();
      });
    }
    return el;
  }

  function showScreenshotError(message) {
    var card = getOrCreateScreenshotErrorCard();
    var msgEl = card.querySelector("#teamfocus-screenshot-error-message");
    if (msgEl) msgEl.textContent = message || "Screenshot capture failed. Check screen recording permissions.";
    card.classList.add("teamfocus-screenshot-error-visible");
  }

  function hideScreenshotError() {
    var card = document.getElementById("teamfocus-screenshot-error-card");
    if (card) card.classList.remove("teamfocus-screenshot-error-visible");
  }

  window.teamfocusNotifications = {
    showToast: showToast,
    hideToast: hideToast,
    showError: showError,
    showSuccess: showSuccess,
    showScreenshotError: showScreenshotError,
    hideScreenshotError: hideScreenshotError,
  };
})();
