(function () {
  const api = window.apiClient;

  if (!api) {
    throw new Error('apiClient must be loaded before usersService');
  }

  window.usersService = {
    getMe: function () {
      return api.get('/users/me');
    },

    updateMe: function (body) {
      return api.patch('/users/me', body);
    },
  };
})();
