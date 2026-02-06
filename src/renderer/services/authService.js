(function () {
  const api = window.apiClient;
  const storage = window.teamfocusStorage;

  if (!api || !storage) {
    throw new Error('apiClient and teamfocusStorage must be loaded before authService');
  }

  window.authService = {
    login: function (email, password) {
      return api.post('/auth/login', { email: email, password: password }).then(function (data) {
        if (data && data.token) {
          return Promise.resolve(storage.setToken(data.token)).then(function () { return data; });
        }
        return data;
      });
    },

    getCurrentUser: function () {
      return api.get('/auth/me');
    },

    logout: function () {
      if (storage.removeToken) storage.removeToken();
    },
  };
})();
