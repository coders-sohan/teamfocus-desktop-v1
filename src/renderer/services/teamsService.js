(function () {
  const api = window.apiClient;
  if (!api) {
    throw new Error('apiClient must be loaded before teamsService');
  }

  window.teamsService = {
    getMyTeam: function () {
      return api.get('/teams/my');
    },
  };
})();
