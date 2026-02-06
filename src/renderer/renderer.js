(function () {
  const storage = window.teamfocusStorage;
  const authService = window.authService;
  const teamsService = window.teamsService;
  const appState = window.appState;

  var loginHtmlLoaded = false;

  function getLoginContainer() {
    return document.getElementById("screen-login-container");
  }

  function getDashboardScreen() {
    return document.getElementById("screen-dashboard");
  }

  function ensureLoginContent() {
    var container = getLoginContainer();
    if (!container) return Promise.reject();
    if (container.querySelector("#login-form")) {
      loginHtmlLoaded = true;
      return Promise.resolve();
    }
    return fetch("./pages/login/login.html")
      .then(function (r) { return r.text(); })
      .then(function (html) {
        container.innerHTML = html;
        loginHtmlLoaded = true;
      });
  }

  function showLogin() {
    appState.clear();
    var dashEl = getDashboardScreen();
    if (dashEl) dashEl.hidden = true;
    ensureLoginContent().then(function () {
      var container = getLoginContainer();
      if (container) container.hidden = false;
      if (window.loginPage && window.loginPage.showError) {
        window.loginPage.showError("");
      }
      if (window.loginPage && window.loginPage.init) {
        window.loginPage.init();
      }
    });
  }

  function showDashboard() {
    var container = getLoginContainer();
    var dashEl = getDashboardScreen();
    if (container) container.hidden = true;
    if (dashEl) dashEl.hidden = false;
    if (window.dashboardPage && window.dashboardPage.render) {
      window.dashboardPage.render();
    }
  }

  window.showLogin = showLogin;
  window.showDashboard = showDashboard;

  function checkPersistentSession() {
    if (!storage || !storage.getToken) {
      showLogin();
      return;
    }
    Promise.resolve(storage.getToken()).then(function (token) {
      if (!token) {
        showLogin();
        return;
      }
      return authService.getCurrentUser();
    }).then(function (user) {
      if (!user || user.role !== "user") {
        authService.logout();
        showLogin();
        return;
      }
      appState.setUser(user);
      return teamsService.getMyTeam();
    })
    .then(function (team) {
      if (!team) return;
      appState.setTeam(team);
      if (!appState.isTrialActive()) {
        authService.logout();
        appState.clear();
        showLogin();
        if (window.loginPage && window.loginPage.showError) {
          window.loginPage.showError("Trial ended. Please contact your team manager.");
        }
        return;
      }
      showDashboard();
    })
    .catch(function () {
      authService.logout();
      appState.clear();
      showLogin();
    });
  }

  function logDisplayInfo() {
    if (!window.electronAPI || !window.electronAPI.getDisplays) {
      return;
    }
    window.electronAPI.getDisplays()
      .then(function (displays) {
        if (!displays || displays.length === 0) {
          console.log("[TeamFocus] No displays found");
          return;
        }
        console.log("[TeamFocus] All displays (primary + secondary):", displays.length);
        displays.forEach(function (d, i) {
          const label = d.primary ? "Primary display" : "Secondary display";
          console.log(`[TeamFocus] ${label} [${i}]:`, JSON.stringify({
            id: d.id,
            bounds: d.bounds,
            workArea: d.workArea,
            scaleFactor: d.scaleFactor,
          }, null, 2));
        });
      })
      .catch(function (err) {
        console.error("[TeamFocus] Failed to get display info:", err);
      });
  }

  function init() {
    logDisplayInfo();
    if (window.apiClient) {
      window.apiClient.onUnauthorized = function () {
        appState.clear();
        showLogin();
        if (window.loginPage && window.loginPage.showError) {
          window.loginPage.showError("Session expired. Please sign in again.");
        }
      };
    }
    var appStarted = false;
    function runApp() {
      if (appStarted) return;
      if (!window.API_BASE_URL) return;
      appStarted = true;
      ensureLoginContent().then(function () {
        checkPersistentSession();
      }).catch(function () {
        checkPersistentSession();
      });
    }
    if (window.API_BASE_URL) {
      runApp();
    } else {
      window.addEventListener("teamfocus-api-ready", runApp);
      setTimeout(runApp, 800);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
