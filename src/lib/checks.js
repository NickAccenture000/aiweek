window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
(function () {
  var L = SkyNet.lib;
  var LANGS = ["EN", "DE", "FR"];

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function buildTerms(glossary) {
    var terms = [], seen = {};
    Object.keys(glossary).forEach(function (k) {
      if (!/^(sys|status)\./.test(k)) return;
      LANGS.forEach(function (lang) {
        var text = glossary[k][lang], id = k + "|" + text.toLowerCase();
        if (seen[id]) return;
        seen[id] = true;
        terms.push({ text: text, key: k, kind: k.indexOf("sys.") === 0 ? "sys" : "status" });
      });
    });
    return terms.sort(function (a, b) { return b.text.length - a.text.length; });
  }

  // Finds system/status terms in text outside tokens. Returns offending spans and a fixed template.
  function findFreeFacts(template, glossary) {
    var terms = buildTerms(glossary);
    var byText = {};
    terms.forEach(function (t) { if (!byText[t.text.toLowerCase()]) byText[t.text.toLowerCase()] = t; });
    var alt = terms.map(function (t) { return escapeRe(t.text); }).join("|");
    var re = new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "giu");
    var offenders = [], fixable = false;
    var lines = template.split("\n").map(function (line) {
      var masked = line.replace(/\{\{[^}]*\}\}/g, function (m) { return "\u0001".repeat(m.length); });
      var matches = [], m;
      re.lastIndex = 0;
      while ((m = re.exec(masked))) matches.push({ start: m.index, end: m.index + m[0].length, term: byText[m[0].toLowerCase()] });
      var spans = [];
      for (var i = 0; i < matches.length; i++) {
        var a = matches[i];
        if (a.term.kind === "sys") {
          var j = i + 1;
          while (j < matches.length && matches[j].term.kind !== "status") j++;
          var end = j < matches.length ? matches[j].end : a.end;
          spans.push({ start: a.start, end: end, key: a.term.key.slice(4) });
          if (j < matches.length) i = j;
        } else {
          offenders.push(line.slice(a.start, a.end));
        }
      }
      var found = spans.map(function (s) { return line.slice(s.start, s.end); });
      offenders = offenders.concat(found);
      spans.slice().reverse().forEach(function (s) {
        fixable = true;
        line = line.slice(0, s.start) + "{{fact:" + s.key + "}}" + line.slice(s.end);
      });
      return line;
    });
    return { offenders: offenders, fix: fixable ? lines.join("\n") : null };
  }

  function requiredSystems(record, rule) {
    if (record.resolved) return record.working.slice();
    var out = [];
    (rule ? rule.required : ["affected", "degraded", "working"]).forEach(function (l) {
      record[l].forEach(function (s) { if (out.indexOf(s) < 0) out.push(s); });
    });
    return out;
  }

  function sorted(arr) { return arr.slice().sort(); }

  function runChecks(draft, enDraft, record, glossary, role, rules) {
    rules = rules || SkyNet.data.roleRules;
    var tokens = L.extractTokens(draft.template);
    var ids = tokens.map(function (t) { return t.id; });
    var results = [];
    function name(sys) { return glossary["sys." + sys] ? glossary["sys." + sys].EN : sys; }

    // values_exact
    var bad = [];
    tokens.forEach(function (t) {
      if (t.type === "fact") {
        if (!L.listOf(record, t.key)) bad.push("\"" + t.key + "\" is not in the record");
        else if (!glossary["sys." + t.key]) bad.push("\"" + t.key + "\" is not in the glossary");
      } else if (t.type === "h") {
        if (!glossary["h." + t.key]) bad.push("heading \"" + t.key + "\" is not in the glossary");
      } else if (t.type === "time") {
        if (t.key !== "expected" && t.key !== "next_update") bad.push("unknown time token \"" + t.key + "\"");
        else if (record.resolved) bad.push("time token " + t.raw + " not allowed in a resolved message");
      } else if (t.type !== "id" && t.type !== "label") bad.push("unknown token " + t.raw);
    });
    results.push({ id: "values_exact", pass: bad.length === 0, message: bad.length ? bad.join("; ") : "All values come from the record" });

    // no_free_facts
    var free = findFreeFacts(draft.template, glossary);
    var nff = {
      id: "no_free_facts", pass: free.offenders.length === 0,
      message: free.offenders.length
        ? free.offenders.map(function (o) { return "\"" + o + "\" is not a record term"; }).join("; ")
        : "No facts written as free text"
    };
    if (!nff.pass && free.fix) nff.fix = free.fix;
    results.push(nff);

    // coverage
    var missing = requiredSystems(record, rules[role]).filter(function (s) { return ids.indexOf("fact:" + s) < 0; }).map(name);
    if (!record.resolved) {
      if (ids.indexOf("time:expected") < 0) missing.push("Expected recovery time");
      if (ids.indexOf("time:next_update") < 0) missing.push("Next update time");
    }
    results.push({ id: "coverage", pass: missing.length === 0, message: missing.length ? "Missing: " + missing.join(", ") : "All required items present" });

    // language_parity
    var enIds = L.extractTokens(enDraft.template).map(function (t) { return t.id; });
    var a = sorted(ids), b = sorted(enIds);
    var same = a.join("|") === b.join("|");
    var reviewName = (enDraft.lang || "EN") + " review version";
    var parityMsg = "Same facts as the " + reviewName;
    if (!same) {
      var miss = b.filter(function (x) { return a.indexOf(x) < 0; });
      var extra = a.filter(function (x) { return b.indexOf(x) < 0; });
      parityMsg = "Facts differ from the " + reviewName + (miss.length ? " (missing: " + miss.join(", ") + ")" : "") + (extra.length ? " (extra: " + extra.join(", ") + ")" : "");
      if (!miss.length && !extra.length) parityMsg += " (token counts differ)";
    }
    results.push({ id: "language_parity", pass: same, message: parityMsg });

    // up_to_date
    var ok = draft.recordVersion === record.version;
    results.push({ id: "up_to_date", pass: ok, message: ok ? "Based on the current record" : "Draft is based on record v" + draft.recordVersion + ", current is v" + record.version });
    return results;
  }

  L.runChecks = runChecks;
  L.findFreeFacts = findFreeFacts;
})();
