window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
(function () {
  // Changes between the last sent record and the current one.
  // A system that moves between lists is reported once, with its old and new list.
  function diffRecords(lastSent, current) {
    if (!lastSent) return [];
    var L = SkyNet.lib, out = [];
    if (lastSent.expected !== current.expected) out.push({ field: "expected", from: lastSent.expected, to: current.expected });
    if (lastSent.major !== current.major) out.push({ field: "major", from: lastSent.major, to: current.major });
    if (lastSent.resolved !== current.resolved) out.push({ field: "resolved", from: lastSent.resolved, to: current.resolved });
    var systems = [];
    L.LISTS.forEach(function (l) {
      lastSent[l].concat(current[l]).forEach(function (s) { if (systems.indexOf(s) < 0) systems.push(s); });
    });
    systems.forEach(function (s) {
      var from = L.listOf(lastSent, s), to = L.listOf(current, s);
      if (from !== to) out.push({ field: "system", system: s, from: from, to: to });
    });
    return out;
  }
  SkyNet.lib.diffRecords = diffRecords;
})();
