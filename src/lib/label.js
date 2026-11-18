window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
(function () {
  var ROLE_NAMES = { ATCO_SUPERVISOR: "ATCO Supervisor", ENGINEERING: "Engineering", MANAGEMENT: "Management" };

  function getLabel(historyLength, record) {
    if (historyLength === 0) return { kind: "initial", n: 0 };
    if (record.resolved) return { kind: "resolved", n: historyLength };
    return { kind: "update", n: historyLength };
  }

  function labelText(label, lang, glossary) {
    var word = glossary["label." + label.kind][lang];
    return label.kind === "update" ? word + " " + label.n : word;
  }

  SkyNet.lib.getLabel = getLabel;
  SkyNet.lib.labelText = labelText;
  SkyNet.lib.roleName = function (role) { return ROLE_NAMES[role] || role; };
})();
