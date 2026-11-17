window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
(function () {
  var LISTS = ["affected", "degraded", "working"];
  var STATUS = { affected: "unavailable", degraded: "degraded", working: "operational" };

  function extractTokens(template) {
    var re = /\{\{\s*(\w+)(?::(\w+))?\s*\}\}/g, out = [], m;
    while ((m = re.exec(template))) {
      out.push({ raw: m[0], type: m[1], key: m[2] || null, index: m.index, id: m[2] ? m[1] + ":" + m[2] : m[1] });
    }
    return out;
  }

  // Which record list (affected/degraded/working) holds this system, or null.
  function listOf(record, sys) {
    for (var i = 0; i < LISTS.length; i++) if (record[LISTS[i]].indexOf(sys) >= 0) return LISTS[i];
    return null;
  }

  function render(template, lang, record, glossary, ctx) {
    var segments = [], text = "", last = 0;
    function addText(v) { if (v) { segments.push({ type: "text", value: v }); text += v; } }
    function addChip(v, field) { segments.push({ type: "chip", value: v, sourceField: field }); text += v; }

    extractTokens(template).forEach(function (t) {
      addText(template.slice(last, t.index));
      last = t.index + t.raw.length;
      if (t.type === "id") addChip(record.id, "id");
      else if (t.type === "label") addChip(ctx.label, "label");
      else if (t.type === "h") addText(glossary["h." + t.key] ? glossary["h." + t.key][lang] : t.raw);
      else if (t.type === "time") {
        if (t.key === "expected") addChip(record.expected == null ? "—" : record.expected, "expected");
        else if (t.key === "next_update") addChip(ctx.nextUpdate || "--:--", "next_update");
        else addText(t.raw);
      } else if (t.type === "fact") {
        var list = listOf(record, t.key), sys = glossary["sys." + t.key];
        if (!list || !sys) addText(t.raw);
        else addChip(sys[lang] + (lang === "FR" ? " : " : ": ") + glossary["status." + STATUS[list]][lang], list);
      } else addText(t.raw);
    });
    addText(template.slice(last));
    return { text: text, segments: segments };
  }

  SkyNet.lib.render = render;
  SkyNet.lib.extractTokens = extractTokens;
  SkyNet.lib.listOf = listOf;
  SkyNet.lib.LISTS = LISTS;
  SkyNet.lib.STATUS = STATUS;
})();
