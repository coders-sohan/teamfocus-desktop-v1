(function () {
  const authService = window.authService;
  const usersService = window.usersService;
  const teamsService = window.teamsService;
  const appState = window.appState;

  function getById(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var el = getById(id);
    if (el) el.textContent = text || "—";
  }

  function formatTrialEnds(isoStr) {
    if (!isoStr) return "—";
    var d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function formatInterval(minutes) {
    if (minutes == null || minutes === undefined) return "—";
    if (minutes === 1) return "1 minute";
    return minutes + " minutes";
  }

  function showEditError(msg) {
    var el = getById("profile-edit-error");
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  function render() {
    var user = appState && appState.user;
    var team = appState && appState.team;

    if (user) {
      setText("profile-name", user.name || user.email);
      setText("profile-email", user.email);
    } else {
      setText("profile-name", "—");
      setText("profile-email", "—");
    }

    if (team) {
      setText("profile-team-name", team.name || "—");
      setText("profile-interval", formatInterval(team.screenshotIntervalMinutes));
      setText("profile-trial-ends", formatTrialEnds(team.trialEndsAt));
    } else {
      setText("profile-team-name", "—");
      setText("profile-interval", "—");
      setText("profile-trial-ends", "—");
    }

    var form = getById("profile-edit-form");
    if (form) {
      form.hidden = true;
      var input = getById("profile-edit-name");
      if (input) input.value = user ? (user.name || "") : "";
    }
    showEditError("");
    loadAppSettings();
  }

  function loadAppSettings() {
    var section = getById("profile-app-section");
    var checkbox = getById("profile-auto-launch");
    if (!window.electronAPI || !window.electronAPI.getAutoLaunch) {
      if (section) section.hidden = true;
      return;
    }
    if (section) section.hidden = false;
    window.electronAPI.getAutoLaunch().then(function (enabled) {
      if (checkbox) checkbox.checked = !!enabled;
    }).catch(function () {
      if (section) section.hidden = true;
    });
  }

  function fetchAndRender() {
    var userPromise = (usersService && usersService.getMe) ? usersService.getMe() : (authService && authService.getCurrentUser) ? authService.getCurrentUser() : Promise.resolve(null);
    var teamPromise = (teamsService && teamsService.getMyTeam) ? teamsService.getMyTeam() : Promise.resolve(null);

    Promise.all([userPromise, teamPromise])
      .then(function (results) {
        var user = results[0];
        var team = results[1];
        if (user && appState.setUser) appState.setUser(user);
        if (team && appState.setTeam) appState.setTeam(team);
        render();
      })
      .catch(function () {
        render();
      });
  }

  function init() {
    var editToggle = getById("profile-edit-toggle");
    var form = getById("profile-edit-form");
    var editName = getById("profile-edit-name");
    var cancelBtn = getById("profile-edit-cancel");
    var logoutBtn = getById("profile-logout");

    if (editToggle && form) {
      editToggle.addEventListener("click", function () {
        form.hidden = !form.hidden;
        if (!form.hidden && editName) {
          editName.value = (appState && appState.user) ? (appState.user.name || "") : "";
          editName.focus();
        }
        showEditError("");
      });
    }

    if (cancelBtn && form) {
      cancelBtn.addEventListener("click", function () {
        form.hidden = true;
        showEditError("");
      });
    }

    if (form && usersService && usersService.updateMe) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = editName ? editName.value.trim() : "";
        showEditError("");
        var saveBtn = form.querySelector(".profile-save-btn");
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving…";
        }
        usersService.updateMe({ name: name })
          .then(function (updated) {
            if (appState.setUser) appState.setUser(updated);
            form.hidden = true;
            render();
          })
          .catch(function (err) {
            var msg = (err && err.message) ? err.message : "Failed to update profile.";
            showEditError(msg);
          })
          .finally(function () {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.textContent = "Save";
            }
          });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        if (authService && authService.logout) authService.logout();
        if (appState && appState.clear) appState.clear();
        if (window.showLogin) window.showLogin();
      });
    }

    var autoLaunchCheckbox = getById("profile-auto-launch");
    if (autoLaunchCheckbox && window.electronAPI && window.electronAPI.setAutoLaunch) {
      autoLaunchCheckbox.addEventListener("change", function () {
        window.electronAPI.setAutoLaunch(autoLaunchCheckbox.checked);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.profilePage = {
    render: fetchAndRender,
    init: init,
  };
})();
