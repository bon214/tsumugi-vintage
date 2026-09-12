/* GA4 bridge for the standalone case-study page. The shared adapter owns all
   privacy, environment, opt-out, reload and PII checks. */
(function (root) {
  "use strict";

  function ready() {
    var analytics = root.TSUMUGI_ANALYTICS;
    if (!analytics) return;
    analytics.pageView({ title: root.document.title, group: "case_study" });
    root.document.addEventListener("click", function (event) {
      var link = event.target && event.target.closest
        ? event.target.closest("[data-ga-destination]") : null;
      if (!link) return;
      analytics.track("case_study_site_select", {
        destination: String(link.getAttribute("data-ga-destination") || "site").slice(0, 40)
      });
    });
  }

  if (root.document.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else ready();
})(window);
