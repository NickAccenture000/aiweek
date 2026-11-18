window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
(function () {
  var ROLE_ORDER = ["ATCO_SUPERVISOR", "ENGINEERING", "MANAGEMENT"];
  var LANG_ORDER = ["EN", "DE", "FR"];

  function roleNotified(role, record, rules) {
    var r = rules[role];
    return !!r && (r.notified === "always" || (r.notified === "major" && !!record.major));
  }

  // Active contacts whose role is notified, plus manual adds, minus manual removes.
  function getRecipients(record, contacts, rules, overrides) {
    var o = overrides || {};
    var added = o.added || [], removed = o.removed || [];
    return contacts.filter(function (c) {
      if (!c.active || removed.indexOf(c.id) >= 0) return false;
      return roleNotified(c.role, record, rules) || added.indexOf(c.id) >= 0;
    });
  }

  // Per notified role: the review version (operator language, EN by default) plus every recipient language.
  // reviewLang may be a language code or a function(role) -> code.
  function getDraftKeys(recipients, reviewLang) {
    var keys = [];
    ROLE_ORDER.forEach(function (role) {
      var mine = recipients.filter(function (c) { return c.role === role; });
      if (!mine.length) return;
      var rl = typeof reviewLang === "function" ? reviewLang(role) : (reviewLang || "EN");
      LANG_ORDER.forEach(function (lang) {
        var hasRecipient = mine.some(function (c) { return c.lang === lang; });
        if (lang === rl || hasRecipient) {
          keys.push({ role: role, lang: lang, key: role + ":" + lang, review: lang === rl, reviewOnly: lang === rl && !hasRecipient });
        }
      });
    });
    return keys;
  }

  SkyNet.lib.getRecipients = getRecipients;
  SkyNet.lib.getDraftKeys = getDraftKeys;
  SkyNet.lib.ROLE_ORDER = ROLE_ORDER;
  SkyNet.lib.LANG_ORDER = LANG_ORDER;
})();
