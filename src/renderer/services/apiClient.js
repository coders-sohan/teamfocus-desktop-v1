(function () {
  const storage = window.teamfocusStorage;

  var offline = false;
  var offlineListeners = [];
  var requestQueue = [];
  var MAX_RETRIES = 3;
  var RETRY_BASE_MS = 1000;

  function getBaseUrl() {
    const base = (window.API_BASE_URL && String(window.API_BASE_URL).trim()) || "";
    return base.replace(/\/$/, "");
  }

  function setOffline(value) {
    if (offline === value) return;
    offline = value;
    offlineListeners.forEach(function (fn) {
      try {
        fn(offline);
      } catch (e) {
        console.error("[apiClient] offline listener error:", e);
      }
    });
  }

  function isNetworkError(err) {
    if (!err) return false;
    if (err.message && (err.message.indexOf("Failed to fetch") !== -1 || err.message.indexOf("NetworkError") !== -1)) return true;
    if (typeof navigator !== "undefined" && !navigator.onLine) return true;
    return false;
  }

  function isRetryableStatus(status) {
    return status >= 500 && status < 600;
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function showTrialEndedMessage() {
    if (window.teamfocusNotifications && window.teamfocusNotifications.showError) {
      window.teamfocusNotifications.showError("Trial ended. Please contact your team manager.");
    }
  }

  function flushQueue() {
    if (requestQueue.length === 0) return;
    var copy = requestQueue.slice();
    requestQueue = [];
    copy.forEach(function (item) {
      window.apiClient.request(item.path, item.options).catch(function () {});
    });
  }

  window.apiClient = {
    isOffline: function () {
      return offline;
    },

    subscribeOffline: function (fn) {
      if (typeof fn === "function") offlineListeners.push(fn);
    },

    unsubscribeOffline: function (fn) {
      var i = offlineListeners.indexOf(fn);
      if (i !== -1) offlineListeners.splice(i, 1);
    },

    request: function (path, options) {
      options = options || {};
      var baseUrl = getBaseUrl();
      if (!baseUrl) {
        return Promise.reject(
          new Error("API base URL is not configured. The app may still be loading.")
        );
      }
      var attempt = options._retryAttempt || 0;
      var self = this;

      function doRequest() {
        return (storage && storage.getToken ? storage.getToken() : Promise.resolve(null)).then(function (token) {
          var headers = Object.assign({}, options.headers || {});
          if (token) headers["Authorization"] = "Bearer " + token;

          if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
            if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
          }

          var fetchOptions = {
            method: (options.method || "GET").toUpperCase(),
            headers: headers,
          };

          if (options.body !== undefined && options.body !== null) {
            if (options.body instanceof FormData) {
              delete fetchOptions.headers["Content-Type"];
              fetchOptions.body = options.body;
            } else if (headers["Content-Type"] === "application/json") {
              fetchOptions.body = JSON.stringify(options.body);
            } else {
          fetchOptions.body = options.body;
          }
        }

        var url = path.startsWith("http") ? path : baseUrl + (path.startsWith("/") ? path : "/" + path);

          return fetch(url, fetchOptions).then(function (res) {
            var contentType = res.headers.get("Content-Type") || "";
            var isJson = contentType.indexOf("application/json") !== -1;

            if (res.ok) {
              setOffline(false);
              if (res.status === 204 || (isJson && res.headers.get("Content-Length") === "0")) {
                return null;
              }
              return isJson ? res.json() : res.text();
            }

            return (isJson ? res.json() : res.text()).then(function (data) {
              var err = new Error(data && data.message ? data.message : data && data.error ? data.error : "Request failed");
              err.status = res.status;
              err.error = data && data.error ? data.error : null;
              err.message = data && data.message ? data.message : err.message;
              err.responseData = data;

              if (res.status === 401 && storage && storage.removeToken) {
                storage.removeToken();
              }
              if (res.status === 403) {
                var trialEnded =
                  (data && (data.error === "trial_ended" || (typeof data.error === "string" && data.error.toLowerCase().indexOf("trial") !== -1))) ||
                  (data && data.message && data.message.toLowerCase().indexOf("trial") !== -1);
                if (trialEnded) showTrialEndedMessage();
              }
              if ((res.status === 401 || res.status === 403) && window.apiClient.onUnauthorized) {
                window.apiClient.onUnauthorized(err);
              }
              throw err;
            });
          });
        });
      }

      var promise = doRequest().catch(function (err) {
        var shouldRetry =
          attempt < MAX_RETRIES - 1 &&
          (isNetworkError(err) || (err.status && isRetryableStatus(err.status)));
        if (shouldRetry) {
          var waitMs = RETRY_BASE_MS * Math.pow(2, attempt);
          return delay(waitMs).then(function () {
            var nextOptions = Object.assign({}, options, { _retryAttempt: attempt + 1 });
            return self.request(path, nextOptions);
          });
        }
        if (isNetworkError(err) || (typeof navigator !== "undefined" && !navigator.onLine)) {
          setOffline(true);
          var queueOpts = Object.assign({}, options);
          delete queueOpts._retryAttempt;
          requestQueue.push({ path: path, options: queueOpts });
        }
        throw err;
      });

      return promise;
    },

    get: function (path) {
      return this.request(path, { method: "GET" });
    },

    post: function (path, body) {
      return this.request(path, { method: "POST", body: body });
    },

    patch: function (path, body) {
      return this.request(path, { method: "PATCH", body: body });
    },

    delete: function (path) {
      return this.request(path, { method: "DELETE" });
    },
  };

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("online", function () {
      setOffline(false);
      flushQueue();
    });
    window.addEventListener("offline", function () {
      setOffline(true);
    });
    if (!navigator.onLine) {
      setOffline(true);
    }
  }
})();
