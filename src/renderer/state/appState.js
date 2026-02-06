(function () {
  const state = {
    user: null,
    team: null,
    workStatus: "idle",
    lastResumeAt: null,
    onLogout: null,
    workStatusListeners: [],
    userListeners: [],
    teamListeners: [],
  };

  function notifyUserListeners() {
    state.userListeners.forEach(function (fn) {
      try {
        fn(state.user);
      } catch (e) {
        console.error("[appState] user listener error:", e);
      }
    });
  }

  function notifyTeamListeners() {
    state.teamListeners.forEach(function (fn) {
      try {
        fn(state.team);
      } catch (e) {
        console.error("[appState] team listener error:", e);
      }
    });
  }

  function setUser(user) {
    state.user = user;
    notifyUserListeners();
  }

  function setTeam(team) {
    state.team = team;
    notifyTeamListeners();
  }

  function subscribeUser(fn) {
    if (typeof fn === "function") state.userListeners.push(fn);
  }

  function unsubscribeUser(fn) {
    var i = state.userListeners.indexOf(fn);
    if (i !== -1) state.userListeners.splice(i, 1);
  }

  function subscribeTeam(fn) {
    if (typeof fn === "function") state.teamListeners.push(fn);
  }

  function unsubscribeTeam(fn) {
    var i = state.teamListeners.indexOf(fn);
    if (i !== -1) state.teamListeners.splice(i, 1);
  }

  function notifyWorkStatusListeners() {
    state.workStatusListeners.forEach(function (fn) {
      try {
        fn(state.workStatus, state.lastResumeAt);
      } catch (e) {
        console.error("[appState] workStatus listener error:", e);
      }
    });
  }

  function setWorkStatus(status, options) {
    options = options || {};
    state.workStatus = status;
    if (status === "working" && options.lastResumeAt != null) {
      state.lastResumeAt = options.lastResumeAt instanceof Date ? options.lastResumeAt : new Date(options.lastResumeAt);
    } else {
      state.lastResumeAt = null;
    }
    notifyWorkStatusListeners();
  }

  function subscribeWorkStatus(fn) {
    if (typeof fn !== "function") return;
    state.workStatusListeners.push(fn);
  }

  function unsubscribeWorkStatus(fn) {
    var i = state.workStatusListeners.indexOf(fn);
    if (i !== -1) state.workStatusListeners.splice(i, 1);
  }

  function isTrialActive() {
    if (!state.team || !state.team.trialEndsAt) return true;
    return new Date(state.team.trialEndsAt) > new Date();
  }

  function clear() {
    state.user = null;
    state.team = null;
    state.workStatus = "idle";
    state.lastResumeAt = null;
    notifyUserListeners();
    notifyTeamListeners();
  }

  window.appState = {
    get user() { return state.user; },
    get team() { return state.team; },
    get workStatus() { return state.workStatus; },
    get lastResumeAt() { return state.lastResumeAt; },
    setUser: setUser,
    setTeam: setTeam,
    setWorkStatus: setWorkStatus,
    subscribeWorkStatus: subscribeWorkStatus,
    unsubscribeWorkStatus: unsubscribeWorkStatus,
    subscribeUser: subscribeUser,
    unsubscribeUser: unsubscribeUser,
    subscribeTeam: subscribeTeam,
    unsubscribeTeam: unsubscribeTeam,
    isTrialActive: isTrialActive,
    clear: clear,
    set onLogout(fn) { state.onLogout = fn; },
    get onLogout() { return state.onLogout; },
  };
})();
