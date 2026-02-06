const TOKEN_KEY = "teamfocus_token";

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

function setToken(token) {
  if (useSecureStorage()) {
    return window.electronAPI.setSecureToken(token || "").then(function (ok) {
      if (ok) {
        if (!token) localStorage.removeItem(TOKEN_KEY);
        return;
      }
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    });
  }
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  return Promise.resolve();
}

function removeToken() {
  if (useSecureStorage()) {
    return window.electronAPI.removeSecureToken().then(function () {
      localStorage.removeItem(TOKEN_KEY);
    });
  }
  localStorage.removeItem(TOKEN_KEY);
  return Promise.resolve();
}

function clear() {
  return removeToken();
}

window.teamfocusStorage = {
  getToken: getToken,
  setToken: setToken,
  removeToken: removeToken,
  clear: clear,
};
