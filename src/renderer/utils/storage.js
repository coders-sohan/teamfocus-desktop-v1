const TOKEN_KEY = "teamfocus_token";
const LOGGED_IN_AT_KEY = "teamfocus_logged_in_at";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function useSecureStorage() {
  return (
    typeof window !== "undefined" &&
    window.electronAPI &&
    typeof window.electronAPI.getSecureToken === "function"
  );
}

function getToken() {
  if (useSecureStorage()) {
    return window.electronAPI.getSecureToken().then(function (t) {
      if (t) return t;
      return localStorage.getItem(TOKEN_KEY);
    });
  }
  return Promise.resolve(localStorage.getItem(TOKEN_KEY));
}

function getLoggedInAt() {
  try {
    var raw = localStorage.getItem(LOGGED_IN_AT_KEY);
    if (!raw) return null;
    var n = parseInt(raw, 10);
    if (isNaN(n)) return null;
    return n;
  } catch (e) {
    return null;
  }
}

function setToken(token) {
  if (useSecureStorage()) {
    return window.electronAPI.setSecureToken(token || "").then(function (ok) {
      if (ok) {
        if (!token) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(LOGGED_IN_AT_KEY);
        } else {
          localStorage.setItem(LOGGED_IN_AT_KEY, String(Date.now()));
        }
        return;
      }
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(LOGGED_IN_AT_KEY, String(Date.now()));
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(LOGGED_IN_AT_KEY);
      }
    });
  }
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(LOGGED_IN_AT_KEY, String(Date.now()));
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGGED_IN_AT_KEY);
  }
  return Promise.resolve();
}

function removeToken() {
  if (useSecureStorage()) {
    return window.electronAPI.removeSecureToken().then(function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LOGGED_IN_AT_KEY);
    });
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LOGGED_IN_AT_KEY);
  return Promise.resolve();
}

function clear() {
  return removeToken();
}

function isSessionExpired() {
  var loggedInAt = getLoggedInAt();
  if (loggedInAt == null) return false;
  return Date.now() - loggedInAt > SESSION_MAX_AGE_MS;
}

window.teamfocusStorage = {
  getToken: getToken,
  setToken: setToken,
  removeToken: removeToken,
  clear: clear,
  getLoggedInAt: getLoggedInAt,
  isSessionExpired: isSessionExpired,
  SESSION_MAX_AGE_DAYS: 30,
};
