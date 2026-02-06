(function () {
  const api = window.apiClient;
  if (!api) {
    throw new Error('apiClient must be loaded before workEventsService');
  }

  function toQueryString(params) {
    const parts = [];
    for (const key in params) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    }
    return parts.length ? '?' + parts.join('&') : '';
  }

  window.workEventsService = {
    createWorkEvent: function (eventType) {
      return api.post('/work-events', { eventType: eventType });
    },

    getMyWorkEvents: function (params) {
      params = params || {};
      const query = toQueryString({
        page: params.page,
        limit: params.limit,
        eventType: params.eventType,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        sort: params.sort,
        order: params.order,
      });
      return api.get('/work-events/my' + query);
    },

    getMyWorkSummary: function (params) {
      params = params || {};
      const query = toQueryString({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      });
      return api.get('/work-events/my/summary' + query);
    },
  };
})();
