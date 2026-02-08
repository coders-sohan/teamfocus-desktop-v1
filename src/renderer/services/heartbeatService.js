/**
 * Heartbeat service: sends heartbeat every 5 min when work session is active (start/resume).
 * When work is paused or stopped, sends workSessionActive: false and stops the interval.
 * Team manager can see "active" vs "last seen" from GET /teams/my/members.
 */
(function () {
  const api = window.apiClient;
  const appState = window.appState;
  if (!api || !appState) {
    return;
  }

  var heartbeatIntervalId = null;
  var heartbeatIntervalMs = 5 * 60 * 1000; // 5 minutes

  function sendHeartbeat(workSessionActive) {
    return api
      .post("/users/me/heartbeat", { workSessionActive: workSessionActive })
      .catch(function (err) {
        if (err && err.status !== 401 && err.status !== 403) {
          console.warn("[heartbeat] send failed:", err.message || err);
        }
      });
  }

  function startHeartbeatInterval() {
    stopHeartbeatInterval();
    sendHeartbeat(true);
    heartbeatIntervalId = setInterval(function () {
      if (appState.workStatus === "working") {
        sendHeartbeat(true);
      } else {
        stopHeartbeatInterval();
      }
    }, heartbeatIntervalMs);
  }

  function stopHeartbeatInterval() {
    if (heartbeatIntervalId) {
      clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = null;
    }
  }

  function onWorkStatusChange(status) {
    if (status === "working") {
      startHeartbeatInterval();
    } else {
      stopHeartbeatInterval();
      sendHeartbeat(false);
    }
  }

  function init() {
    appState.subscribeWorkStatus(onWorkStatusChange);
    if (appState.workStatus === "working") {
      startHeartbeatInterval();
    }
  }

  function destroy() {
    stopHeartbeatInterval();
    appState.unsubscribeWorkStatus(onWorkStatusChange);
  }

  window.heartbeatService = {
    init: init,
    destroy: destroy,
  };
})();
