(function () {
  const authService = window.authService;
  const teamsService = window.teamsService;
  const appState = window.appState;

  function getForm() {
    return document.getElementById("login-form");
  }

  function getErrorEl() {
    return document.getElementById("login-error");
  }

  function getSubmitBtn() {
    return document.getElementById("login-submit");
  }

  function showError(msg) {
    const el = getErrorEl();
    if (el) {
      el.textContent = msg || "";
      el.hidden = !msg;
    }
  }

  function setLoading(loading) {
    const btn = getSubmitBtn();
    if (btn) {
      btn.disabled = !!loading;
      btn.textContent = loading ? "Signing in…" : "Sign in";
    }
  }

  function handleLoginSuccess() {
    if (window.showDashboard) {
      window.showDashboard();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const form = getForm();
    if (!form) return;

    const email = (form.querySelector("#login-email") || {}).value || "";
    const password = (form.querySelector("#login-password") || {}).value || "";

    if (!email || !password) {
      showError("Please enter email and password.");
      return;
    }

    showError("");
    setLoading(true);

    authService
      .login(email.trim(), password)
      .then(function (data) {
        const user = data && data.user;
        if (!user) {
          showError("Invalid response from server.");
          setLoading(false);
          return;
        }
        if (user.role !== "user") {
          authService.logout();
          showError("This app is for team members only. Team managers should use the web app.");
          setLoading(false);
          return;
        }
        return teamsService.getMyTeam().then(function (team) {
          appState.setUser(user);
          appState.setTeam(team);
          if (!appState.isTrialActive()) {
            authService.logout();
            appState.clear();
            showError("Trial ended. Please contact your team manager.");
            setLoading(false);
            return;
          }
          handleLoginSuccess();
        });
      })
      .catch(function (err) {
        const msg = (err && err.message) || (err && err.error) || "Sign in failed. Try again.";
        showError(msg);
        setLoading(false);
      });
  }

  function initPasswordToggle() {
    const input = document.getElementById("login-password");
    const btn = document.getElementById("login-password-toggle");
    if (!input || !btn) return;
    const icon = btn.querySelector("i");
    btn.addEventListener("click", function () {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      if (icon) {
        icon.classList.remove(isPassword ? "fa-eye" : "fa-eye-slash");
        icon.classList.add(isPassword ? "fa-eye-slash" : "fa-eye");
      }
      btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
      btn.setAttribute("title", isPassword ? "Hide password" : "Show password");
    });
  }

  function init() {
    const form = getForm();
    if (form) {
      form.addEventListener("submit", handleSubmit);
    }
    initPasswordToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.loginPage = { showError: showError, init: init };
})();
