(function () {
  const appState = window.appState;
  const workEventsService = window.workEventsService;

  var sessionTimerId = null;

  function getBadgeEl() {
    return document.getElementById("work-controls-badge");
  }
  function getSessionTimeEl() {
    return document.getElementById("work-controls-session-time");
  }
  function getStartBtn() {
    return document.getElementById("work-controls-start");
  }
  function getPauseBtn() {
    return document.getElementById("work-controls-pause");
  }
  function getResumeBtn() {
    return document.getElementById("work-controls-resume");
  }
  function getStopBtn() {
    return document.getElementById("work-controls-stop");
  }
  function getErrorEl() {
    return document.getElementById("work-controls-error");
  }

  function showError(msg) {
    const el = getErrorEl();
    if (el) {
      el.textContent = msg || "";
      el.hidden = !msg;
    }
  }

  function formatSessionSeconds(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function updateSessionTime() {
    const el = getSessionTimeEl();
    if (!el) return;
    const status = appState.workStatus;
    const lastResumeAt = appState.lastResumeAt;
    if (status !== "working" || !lastResumeAt) {
      el.textContent = "";
      return;
    }
    const elapsed = Math.floor((Date.now() - lastResumeAt.getTime()) / 1000);
    el.textContent = "Session: " + formatSessionSeconds(elapsed);
  }

  function startSessionTimer() {
    stopSessionTimer();
    sessionTimerId = setInterval(updateSessionTime, 1000);
    updateSessionTime();
  }

  function stopSessionTimer() {
    if (sessionTimerId) {
      clearInterval(sessionTimerId);
      sessionTimerId = null;
    }
    const el = getSessionTimeEl();
    if (el) el.textContent = "";
  }

  function updateUI(status) {
    status = status || appState.workStatus;
    const badge = getBadgeEl();
    if (badge) {
      badge.textContent = status === "idle" ? "Idle" : status === "working" ? "Working" : "Paused";
      badge.className = "work-controls-badge work-controls-badge-" + (status === "idle" ? "idle" : status === "working" ? "working" : "paused");
    }

    const startBtn = getStartBtn();
    const pauseBtn = getPauseBtn();
    const resumeBtn = getResumeBtn();
    const stopBtn = getStopBtn();
    if (startBtn) startBtn.disabled = status !== "idle";
    if (pauseBtn) pauseBtn.disabled = status !== "working";
    if (resumeBtn) resumeBtn.disabled = status !== "paused";
    if (stopBtn) stopBtn.disabled = status !== "working" && status !== "paused";

    if (status === "working") {
      startSessionTimer();
    } else {
      stopSessionTimer();
    }
  }

  function onWorkStatusChange(status) {
    updateUI(status);
  }

  function setButtonLabel(btn, label) {
    if (!btn) return;
    var span = btn.querySelector("span");
    if (span) span.textContent = label;
  }

  function transitionStart() {
    if (!appState.isTrialActive()) {
      showError("Trial ended. You cannot start work.");
      return;
    }
    showError("");
    const btn = getStartBtn();
    if (btn) {
      btn.disabled = true;
      setButtonLabel(btn, "Starting…");
    }
    workEventsService
      .createWorkEvent("start")
      .then(function () {
        appState.setWorkStatus("working", { lastResumeAt: new Date() });
      })
      .catch(function (err) {
        showError((err && err.message) || (err && err.error) || "Failed to start.");
        updateUI();
      })
      .finally(function () {
        if (btn) {
          btn.disabled = appState.workStatus !== "idle";
          setButtonLabel(btn, "Start");
        }
      });
  }

  function transitionPause() {
    showError("");
    const btn = getPauseBtn();
    if (btn) {
      btn.disabled = true;
      setButtonLabel(btn, "Pausing…");
    }
    workEventsService
      .createWorkEvent("pause")
      .then(function () {
        appState.setWorkStatus("paused");
      })
      .catch(function (err) {
        showError((err && err.message) || (err && err.error) || "Failed to pause.");
        updateUI();
      })
      .finally(function () {
        if (btn) {
          btn.disabled = appState.workStatus !== "working";
          setButtonLabel(btn, "Pause");
        }
      });
  }

  function transitionResume() {
    if (!appState.isTrialActive()) {
      showError("Trial ended. You cannot resume work.");
      return;
    }
    showError("");
    const btn = getResumeBtn();
    if (btn) {
      btn.disabled = true;
      setButtonLabel(btn, "Resuming…");
    }
    workEventsService
      .createWorkEvent("resume")
      .then(function () {
        appState.setWorkStatus("working", { lastResumeAt: new Date() });
      })
      .catch(function (err) {
        showError((err && err.message) || (err && err.error) || "Failed to resume.");
        updateUI();
      })
      .finally(function () {
        if (btn) {
          btn.disabled = appState.workStatus !== "paused";
          setButtonLabel(btn, "Resume");
        }
      });
  }

  function transitionStop() {
    showError("");
    const btn = getStopBtn();
    if (btn) {
      btn.disabled = true;
      setButtonLabel(btn, "Stopping…");
    }
    workEventsService
      .createWorkEvent("stop")
      .then(function () {
        appState.setWorkStatus("idle");
      })
      .catch(function (err) {
        showError((err && err.message) || (err && err.error) || "Failed to stop.");
        updateUI();
      })
      .finally(function () {
        if (btn) {
          btn.disabled = appState.workStatus !== "working" && appState.workStatus !== "paused";
          setButtonLabel(btn, "Stop");
        }
      });
  }

  function bindButtons() {
    const startBtn = getStartBtn();
    const pauseBtn = getPauseBtn();
    const resumeBtn = getResumeBtn();
    const stopBtn = getStopBtn();
    if (startBtn) startBtn.addEventListener("click", transitionStart);
    if (pauseBtn) pauseBtn.addEventListener("click", transitionPause);
    if (resumeBtn) resumeBtn.addEventListener("click", transitionResume);
    if (stopBtn) stopBtn.addEventListener("click", transitionStop);
  }

  function init() {
    bindButtons();
    appState.subscribeWorkStatus(onWorkStatusChange);
    updateUI();
  }

  function destroy() {
    stopSessionTimer();
    appState.unsubscribeWorkStatus(onWorkStatusChange);
  }

  window.workControls = {
    init: init,
    destroy: destroy,
    render: updateUI,
  };
})();
