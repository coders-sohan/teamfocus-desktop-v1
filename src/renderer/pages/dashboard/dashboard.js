(function () {
  const authService = window.authService;
  const appState = window.appState;
  const teamsService = window.teamsService;
  const workEventsService = window.workEventsService;
  const screenshotUtil = window.screenshotUtil;
  const windowDetection = window.windowDetection;
  const activityLogsService = window.activityLogsService;

  var screenshotIntervalId = null;
  var screenshotRetryCount = 0;
  var maxScreenshotRetries = 1;
  var headerClockId = null;

  function getLogoutBtn() {
    return document.getElementById("dashboard-logout");
  }

  function updateHeaderClock() {
    var now = new Date();
    var timeEl = document.getElementById("header-time");
    var dateEl = document.getElementById("header-date");
    if (timeEl) {
      var h = now.getHours();
      var m = now.getMinutes();
      var s = now.getSeconds();
      timeEl.textContent =
        (h < 10 ? "0" : "") +
        h +
        ":" +
        (m < 10 ? "0" : "") +
        m +
        ":" +
        (s < 10 ? "0" : "") +
        s;
    }
    if (dateEl) {
      var options = {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      };
      dateEl.textContent = now.toLocaleDateString(undefined, options);
    }
  }

  function startHeaderClock() {
    stopHeaderClock();
    updateHeaderClock();
    headerClockId = setInterval(updateHeaderClock, 1000);
  }

  function stopHeaderClock() {
    if (headerClockId) {
      clearInterval(headerClockId);
      headerClockId = null;
    }
  }

  function updateHeaderUser() {
    var user = appState.user;
    var nameEl = document.getElementById("header-user-name");
    var emailEl = document.getElementById("header-user-email");
    if (nameEl) nameEl.textContent = (user && (user.name || user.email)) || "—";
    if (emailEl) emailEl.textContent = (user && user.email) || "—";
  }

  function updateOfflineIndicator() {
    var el = document.getElementById("offline-indicator");
    if (!el) return;
    var offline = window.apiClient && window.apiClient.isOffline && window.apiClient.isOffline();
    el.hidden = !offline;
  }

  function getTrialDaysRemaining() {
    var team = appState.team;
    if (!team || !team.trialEndsAt) return null;
    var end = new Date(team.trialEndsAt);
    var now = new Date();
    if (end <= now) return 0;
    var ms = end - now;
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
  }

  function updateTrialStatus() {
    var el = document.getElementById("trial-status");
    var daysEl = document.getElementById("trial-status-days");
    var labelEl = document.getElementById("trial-status-label");
    var iconEl = document.getElementById("trial-status-icon");
    if (!el || !daysEl || !labelEl) return;
    if (!appState.isTrialActive()) {
      el.classList.add("trial-ended");
      if (daysEl) daysEl.textContent = "Ended";
      if (labelEl) labelEl.textContent = "Contact your team manager.";
      if (iconEl) {
        var i = iconEl.querySelector("i");
        if (i) i.className = "fa-solid fa-circle-exclamation";
      }
      return;
    }
    el.classList.remove("trial-ended");
    if (iconEl) {
      var i = iconEl.querySelector("i");
      if (i) i.className = "fa-solid fa-calendar-check";
    }
    var days = getTrialDaysRemaining();
    if (days === null) {
      if (daysEl) daysEl.textContent = "Active";
      if (labelEl) labelEl.textContent = "Trial in progress.";
    } else if (days <= 0) {
      if (daysEl) daysEl.textContent = "0";
      if (labelEl) labelEl.textContent = "days remaining";
    } else {
      if (daysEl) daysEl.textContent = String(days);
      if (labelEl)
        labelEl.textContent = "day" + (days === 1 ? "" : "s") + " remaining";
    }
  }

  function loadTodaysSummary() {
    if (!workEventsService || !workEventsService.getMyWorkSummary) return;
    var today = new Date();
    var dateStr =
      today.getUTCFullYear() +
      "-" +
      String(today.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getUTCDate()).padStart(2, "0");
    workEventsService
      .getMyWorkSummary({ dateFrom: dateStr, dateTo: dateStr })
      .then(function (res) {
        var day =
          res && res.summary && res.summary.length ? res.summary[0] : null;
        var work =
          day && day.totalWorkMinutes != null ? day.totalWorkMinutes : 0;
        var pause =
          day && day.totalPauseMinutes != null ? day.totalPauseMinutes : 0;
        var sessions = day && day.sessionCount != null ? day.sessionCount : 0;
        var workEl = document.getElementById("summary-work-minutes");
        var pauseEl = document.getElementById("summary-pause-minutes");
        var sessionsEl = document.getElementById("summary-sessions");
        if (workEl) workEl.textContent = work;
        if (pauseEl) pauseEl.textContent = pause;
        if (sessionsEl) sessionsEl.textContent = sessions;
      })
      .catch(function () {
        var workEl = document.getElementById("summary-work-minutes");
        var pauseEl = document.getElementById("summary-pause-minutes");
        var sessionsEl = document.getElementById("summary-sessions");
        if (workEl) workEl.textContent = "—";
        if (pauseEl) pauseEl.textContent = "—";
        if (sessionsEl) sessionsEl.textContent = "—";
      });
  }

  function getScreenshotIntervalMs() {
    var team = appState.team;
    var minutes =
      team && team.screenshotIntervalMinutes != null
        ? Number(team.screenshotIntervalMinutes)
        : 5;
    if (minutes < 1) minutes = 1;
    return minutes * 60 * 1000;
  }

  function doCaptureAndUpload() {
    if (appState.workStatus !== "working") return;
    if (!appState.isTrialActive()) return;
    if (
      !screenshotUtil ||
      !screenshotUtil.captureScreen ||
      !activityLogsService ||
      !activityLogsService.uploadFromCapture
    )
      return;

    function uploadOne(displayIndex, activeWindow) {
      return screenshotUtil.captureScreen(displayIndex).then(function (blob) {
        if (!blob) return Promise.resolve();
        return activityLogsService
          .uploadFromCapture(blob, activeWindow)
          .then(function () {});
      });
    }

    function runInOrder(displayIndexes, activeWindow) {
      var i = 0;
      function next() {
        if (i >= displayIndexes.length) {
          screenshotRetryCount = 0;
          return Promise.resolve();
        }
        var idx = displayIndexes[i];
        i += 1;
        return uploadOne(idx, activeWindow)
          .then(next)
          .catch(function (err) {
            console.error(
              "[dashboard] Activity log upload failed (display " + idx + "):",
              err,
            );
            throw err;
          });
      }
      return next();
    }

    var displaysPromise = screenshotUtil.getDisplays
      ? screenshotUtil.getDisplays().catch(function () { return []; })
      : Promise.resolve([{ index: 0 }]);
    var activeWindowPromise =
      windowDetection && windowDetection.getActiveWindow
        ? windowDetection.getActiveWindow()
        : Promise.resolve(null);

    Promise.all([displaysPromise, activeWindowPromise])
      .then(function (res) {
        var displays = res[0] || [];
        var activeWindow = res[1] || null;
        var displayIndexes = displays.length
          ? displays.map(function (d) { return d.index; }).sort(function (a, b) { return a - b; })
          : [0];
        return runInOrder(displayIndexes, activeWindow);
      })
      .then(function () {
        screenshotRetryCount = 0;
      })
      .catch(function (err) {
        if (screenshotRetryCount < maxScreenshotRetries) {
          screenshotRetryCount += 1;
          setTimeout(doCaptureAndUpload, 5000);
        }
      });
  }

  function startScreenshotTimer() {
    stopScreenshotTimer();
    if (appState.workStatus !== "working") return;
    var intervalMs = getScreenshotIntervalMs();
    doCaptureAndUpload();
    screenshotIntervalId = setInterval(doCaptureAndUpload, intervalMs);
    // Timer continues when window is minimized to tray (renderer keeps running).
  }

  function stopScreenshotTimer() {
    if (screenshotIntervalId) {
      clearInterval(screenshotIntervalId);
      screenshotIntervalId = null;
    }
    screenshotRetryCount = 0;
  }

  function onWorkStatusChange() {
    if (appState.workStatus === "working") {
      startScreenshotTimer();
    } else {
      stopScreenshotTimer();
      if (appState.workStatus === "idle") {
        setTimeout(loadTodaysSummary, 800);
      }
    }
  }

  function render() {
    updateHeaderUser();
    updateTrialStatus();
    updateOfflineIndicator();
    loadTodaysSummary();
    startHeaderClock();
    if (teamsService && teamsService.getMyTeam) {
      teamsService
        .getMyTeam()
        .then(function (team) {
          if (team && appState.setTeam) appState.setTeam(team);
          updateTrialStatus();
        })
        .catch(function () {});
    }
    if (window.workControls && window.workControls.render) {
      window.workControls.render();
    }
  }

  function showPage(page) {
    var dashContent = document.getElementById("dashboard-content");
    var activityContent = document.getElementById("activity-content");
    var profileContent = document.getElementById("profile-content");
    var links = document.querySelectorAll(".sidebar-link[data-page]");
    links.forEach(function (link) {
      var p = link.getAttribute("data-page");
      if (p === page) {
        link.classList.add("sidebar-link-active");
      } else {
        link.classList.remove("sidebar-link-active");
      }
    });
    if (page === "dashboard") {
      if (dashContent) dashContent.hidden = false;
      if (activityContent) activityContent.hidden = true;
      if (profileContent) profileContent.hidden = true;
      if (window.dashboardPage && window.dashboardPage.render) {
        window.dashboardPage.render();
      }
    } else if (page === "activity") {
      if (dashContent) dashContent.hidden = true;
      if (activityContent) activityContent.hidden = false;
      if (profileContent) profileContent.hidden = true;
      if (window.activityPage && window.activityPage.render) {
        window.activityPage.render();
      }
    } else if (page === "profile") {
      if (dashContent) dashContent.hidden = true;
      if (activityContent) activityContent.hidden = true;
      if (profileContent) profileContent.hidden = false;
      if (window.profilePage && window.profilePage.render) {
        window.profilePage.render();
      }
    }
  }

  function initNavLinks() {
    var links = document.querySelectorAll(".sidebar-link[data-page]");
    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var page = link.getAttribute("data-page");
        showPage(page);
      });
    });
  }

  function onScreenshotError(e) {
    var msg = (e && e.detail && e.detail.message) ? e.detail.message : "Screenshot capture failed.";
    if (window.teamfocusNotifications && window.teamfocusNotifications.showError) {
      window.teamfocusNotifications.showError(msg);
    }
  }

  function init() {
    render();
    updateOfflineIndicator();
    if (window.apiClient && window.apiClient.subscribeOffline) {
      window.apiClient.subscribeOffline(updateOfflineIndicator);
    }
    window.addEventListener("teamfocus-screenshot-error", onScreenshotError);
    if (window.workControls && window.workControls.init) {
      window.workControls.init();
    }
    appState.subscribeWorkStatus(onWorkStatusChange);
    onWorkStatusChange();
    initNavLinks();
    var btn = getLogoutBtn();
    if (btn) {
      btn.addEventListener("click", function () {
        stopHeaderClock();
        authService.logout();
        appState.clear();
        if (window.showLogin) {
          window.showLogin();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.dashboardPage = { render: render, init: init };
})();
