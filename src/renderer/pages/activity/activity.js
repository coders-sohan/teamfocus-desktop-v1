(function () {
  const workEventsService = window.workEventsService;

  var currentPage = 1;
  var currentLimit = 20;
  var currentDateFrom = "";
  var currentDateTo = "";

  function getDateInputFrom() {
    return document.getElementById("activity-date-from");
  }
  function getDateInputTo() {
    return document.getElementById("activity-date-to");
  }
  function getApplyBtn() {
    return document.getElementById("activity-apply-filters");
  }
  function getDaySummaryList() {
    return document.getElementById("activity-day-summary-list");
  }
  function getSummaryEmpty() {
    return document.getElementById("activity-summary-empty");
  }
  function getEventsList() {
    return document.getElementById("activity-events-list");
  }
  function getEventsEmpty() {
    return document.getElementById("activity-events-empty");
  }
  function getPaginationEl() {
    return document.getElementById("activity-pagination");
  }

  function formatDateKey(isoDateStr) {
    if (!isoDateStr) return "";
    var d = new Date(isoDateStr);
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, "0");
    var day = String(d.getUTCDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr + "T12:00:00Z");
    return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  }

  function formatTime(isoStr) {
    if (!isoStr) return "";
    var d = new Date(isoStr);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function eventTypeClass(eventType) {
    if (eventType === "start") return "activity-event-type-start";
    if (eventType === "pause") return "activity-event-type-pause";
    if (eventType === "resume") return "activity-event-type-resume";
    if (eventType === "stop") return "activity-event-type-stop";
    return "";
  }

  function setDefaultDateRange() {
    var to = new Date();
    var from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 6);
    currentDateFrom = from.getUTCFullYear() + "-" + (String(from.getUTCMonth() + 1).padStart(2, "0")) + "-" + (String(from.getUTCDate()).padStart(2, "0"));
    currentDateTo = to.getUTCFullYear() + "-" + (String(to.getUTCMonth() + 1).padStart(2, "0")) + "-" + (String(to.getUTCDate()).padStart(2, "0"));
    var fromEl = getDateInputFrom();
    var toEl = getDateInputTo();
    if (fromEl) fromEl.value = currentDateFrom;
    if (toEl) toEl.value = currentDateTo;
  }

  function loadSummary() {
    if (!workEventsService || !workEventsService.getMyWorkSummary) return;
    var list = getDaySummaryList();
    var emptyEl = getSummaryEmpty();
    if (list) list.innerHTML = "<p class=\"activity-loading\">Loading…</p>";
    if (emptyEl) emptyEl.hidden = true;
    workEventsService.getMyWorkSummary({ dateFrom: currentDateFrom, dateTo: currentDateTo }).then(function (res) {
      var list = getDaySummaryList();
      var emptyEl = getSummaryEmpty();
      if (!list) return;
      list.innerHTML = "";
      if (emptyEl) emptyEl.hidden = true;
      var summary = (res && res.summary) || [];
      if (summary.length === 0) {
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      summary.forEach(function (day) {
        var card = document.createElement("div");
        card.className = "activity-day-card";
        card.innerHTML =
          "<span class=\"activity-day-date\">" + formatDisplayDate(day.date) + "</span>" +
          "<span class=\"activity-day-stat\">Work: <strong>" + (day.totalWorkMinutes != null ? day.totalWorkMinutes : 0) + "</strong> min</span>" +
          "<span class=\"activity-day-stat\">Pause: <strong>" + (day.totalPauseMinutes != null ? day.totalPauseMinutes : 0) + "</strong> min</span>" +
          "<span class=\"activity-day-stat\">Sessions: <strong>" + (day.sessionCount != null ? day.sessionCount : 0) + "</strong></span>";
        list.appendChild(card);
      });
    }).catch(function () {
      var list = getDaySummaryList();
      var emptyEl = getSummaryEmpty();
      if (list) list.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
    });
  }

  function loadEvents() {
    if (!workEventsService || !workEventsService.getMyWorkEvents) return;
    var list = getEventsList();
    var emptyEl = getEventsEmpty();
    var paginationEl = getPaginationEl();
    if (list) list.innerHTML = "<p class=\"activity-loading\">Loading…</p>";
    if (emptyEl) emptyEl.hidden = true;
    if (paginationEl) paginationEl.hidden = true;
    workEventsService.getMyWorkEvents({
      dateFrom: currentDateFrom,
      dateTo: currentDateTo,
      page: currentPage,
      limit: currentLimit,
      sort: "timestamp",
      order: "desc",
    }).then(function (res) {
      var list = getEventsList();
      var emptyEl = getEventsEmpty();
      var paginationEl = getPaginationEl();
      if (!list) return;
      list.innerHTML = "";
      if (emptyEl) emptyEl.hidden = true;
      if (paginationEl) paginationEl.hidden = true;
      var events = (res && res.workEvents) || [];
      var pagination = (res && res.pagination) || {};

      if (events.length === 0) {
        if (emptyEl) emptyEl.hidden = false;
        return;
      }

      var byDate = {};
      events.forEach(function (ev) {
        var key = formatDateKey(ev.timestamp);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(ev);
      });
      var dates = Object.keys(byDate).sort().reverse();
      dates.forEach(function (dateKey) {
        var group = document.createElement("div");
        group.className = "activity-events-group";
        group.innerHTML = "<div class=\"activity-events-group-title\">" + formatDisplayDate(dateKey) + "</div>";
        var ul = document.createElement("div");
        ul.className = "activity-events-list-group";
        byDate[dateKey].forEach(function (ev) {
          var item = document.createElement("div");
          item.className = "activity-event-item";
          item.innerHTML =
            "<span class=\"activity-event-type " + eventTypeClass(ev.eventType) + "\">" + (ev.eventType || "") + "</span>" +
            "<span class=\"activity-event-time\">" + formatTime(ev.timestamp) + "</span>";
          ul.appendChild(item);
        });
        group.appendChild(ul);
        list.appendChild(group);
      });

      var total = pagination.total;
      var totalPages = pagination.totalPages;
      if (totalPages > 1 && paginationEl) {
        paginationEl.hidden = false;
        var from = (currentPage - 1) * currentLimit + 1;
        var to = Math.min(currentPage * currentLimit, total);
        paginationEl.innerHTML =
          "<span class=\"activity-pagination-info\">" + from + "–" + to + " of " + total + "</span>" +
          "<div class=\"activity-pagination-btns\">" +
          "<button type=\"button\" id=\"activity-prev\" " + (currentPage <= 1 ? "disabled" : "") + ">Previous</button>" +
          "<button type=\"button\" id=\"activity-next\" " + (currentPage >= totalPages ? "disabled" : "") + ">Next</button>" +
          "</div>";
        var prev = document.getElementById("activity-prev");
        var next = document.getElementById("activity-next");
        if (prev) prev.addEventListener("click", function () { currentPage -= 1; loadEvents(); });
        if (next) next.addEventListener("click", function () { currentPage += 1; loadEvents(); });
      }
    }).catch(function () {
      var list = getEventsList();
      var emptyEl = getEventsEmpty();
      if (list) list.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      if (getPaginationEl()) getPaginationEl().hidden = true;
    });
  }

  function applyFilters() {
    var fromEl = getDateInputFrom();
    var toEl = getDateInputTo();
    if (fromEl && fromEl.value) currentDateFrom = fromEl.value;
    if (toEl && toEl.value) currentDateTo = toEl.value;
    currentPage = 1;
    loadSummary();
    loadEvents();
  }

  function render() {
    if (!currentDateFrom || !currentDateTo) {
      setDefaultDateRange();
    }
    loadSummary();
    loadEvents();
  }

  function init() {
    setDefaultDateRange();
    var applyBtn = getApplyBtn();
    if (applyBtn) {
      applyBtn.addEventListener("click", applyFilters);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.activityPage = { render: render, init: init };
})();
