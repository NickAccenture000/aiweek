window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
// Pure view functions: state + derived view -> HTML string.
(function () {
  var D = SkyNet.data, L = SkyNet.lib, G = D.glossary;
  var views = {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
    });
  }
  function attr(s) { return esc(s); }
  function sysName(s) { return G["sys." + s] ? G["sys." + s].EN : s; }
  function statusEN(list) { return list ? G["status." + L.STATUS[list]].EN : "—"; }
  var STATUS_ICON = { affected: "✖", degraded: "▲", working: "✔" };

  function chip(text, field, was) {
    return "<span class=\"chip chip-" + attr(field || "plain") + "\">" + esc(text) + "</span>" +
      (was ? " <span class=\"was\">was " + esc(was) + "</span>" : "");
  }

  // ---------- Record panel ----------
  views.record = function (st) {
    var r = st.record, diff = L.diffRecords(st.lastSent, r);
    var moved = {};
    diff.forEach(function (d) { if (d.field === "system") moved[d.system] = d.from; });
    var exp = diff.filter(function (d) { return d.field === "expected"; })[0];
    var major = diff.filter(function (d) { return d.field === "major"; })[0];
    var res = diff.filter(function (d) { return d.field === "resolved"; })[0];
    function yn(b) { return b ? "Yes" : "No"; }
    function list(name, key) {
      var items = r[key].map(function (s) {
        return "<li>" + chip(sysName(s) + ": " + statusEN(key), key, moved[s] ? statusEN(moved[s]) : null) + "</li>";
      }).join("");
      return "<h3>" + name + "</h3><ul class=\"sys-list\">" + (items || "<li class=\"muted\">—</li>") + "</ul>";
    }
    return "<h2>Incident record</h2>" +
      "<p class=\"rec-title\"><strong>" + esc(r.id) + "</strong> · " + esc(r.title) + "</p>" +
      "<p class=\"muted\">Record v" + r.version + " · updated " + esc(r.updatedAt.replace("T", " ")) + "</p>" +
      "<dl class=\"rec-flags\">" +
      "<dt>Major incident</dt><dd>" + chip(yn(r.major), r.major ? "affected" : "working", major ? yn(major.from) : null) + "</dd>" +
      "<dt>Resolved</dt><dd>" + chip(yn(r.resolved), r.resolved ? "working" : "plain", res ? yn(res.from) : null) + "</dd>" +
      "<dt>Expected recovery</dt><dd>" + chip(r.expected == null ? "—" : r.expected, "expected", exp ? (exp.from == null ? "—" : exp.from) : null) + "</dd>" +
      "</dl>" +
      list("Affected", "affected") + list("Degraded", "degraded") + list("Operational", "working");
  };

  // ---------- Messages panel ----------
  function changeText(d) {
    function v(x) { return x == null ? "—" : x; }
    if (d.field === "expected") return "Expected recovery: " + v(d.from) + " → " + v(d.to);
    if (d.field === "major") return "Major incident: " + (d.from ? "yes" : "no") + " → " + (d.to ? "yes" : "no");
    if (d.field === "resolved") return "Resolved: " + (d.from ? "yes" : "no") + " → " + (d.to ? "yes" : "no");
    return sysName(d.system) + ": " + statusEN(d.from) + " → " + statusEN(d.to);
  }

  function segmentsHtml(segs) {
    return segs.map(function (s) {
      return s.type === "chip" ? "<span class=\"chip chip-" + attr(s.sourceField || "plain") + "\" title=\"from record: " + attr(s.sourceField) + "\">" + esc(s.value) + "</span>" : esc(s.value);
    }).join("");
  }

  function recipientSummary(st, v) {
    var parts = [v.recipients.length + " recipients"];
    if (st.lastSent) {
      var prev = L.getRecipients(st.lastSent, D.contacts, D.roleRules, st.overrides).map(function (c) { return c.role; });
      var cur = v.recipients.map(function (c) { return c.role; });
      L.ROLE_ORDER.forEach(function (role) {
        if (cur.indexOf(role) >= 0 && prev.indexOf(role) < 0) parts.push(L.roleName(role) + " added");
        if (cur.indexOf(role) < 0 && prev.indexOf(role) >= 0) parts.push(L.roleName(role) + " removed");
      });
    }
    var html = "<div class=\"recipients\"><button class=\"link\" data-action=\"toggle-recipients\" aria-expanded=\"" + !!st.recipientsOpen + "\">" +
      "<span class=\"caret\">" + (st.recipientsOpen ? "▾" : "▸") + "</span> " + esc(parts.join(" · ")) + "</button>";
    if (st.recipientsOpen) {
      html += "<ul class=\"recipient-list\">" + D.contacts.map(function (c) {
        var on = v.recipients.some(function (x) { return x.id === c.id; });
        return "<li><label><input type=\"checkbox\" data-action=\"toggle-recipient\" data-id=\"" + c.id + "\"" + (on ? " checked" : "") + (c.active ? "" : " disabled") + "> " +
          esc(c.name) + " <span class=\"muted\">" + L.roleName(c.role) + " · " + c.lang + (c.active ? "" : " · inactive") + "</span></label></li>";
      }).join("") + "</ul>";
    }
    return html + "</div>";
  }

  function miniGrid(v) {
    var short = { ATCO_SUPERVISOR: "ATCO", ENGINEERING: "ENG", MANAGEMENT: "MGMT" };
    var rows = v.roles.map(function (r) {
      return "<tr><th>" + short[r.role] + "</th>" + L.LANG_ORDER.map(function (lang) {
        var it = v.items[r.role + ":" + lang];
        if (!it) return "<td class=\"cell-none\">·</td>";
        if (it.needs) return "<td class=\"cell-bad\" title=\"needs you\">❌</td>";
        return it.failing.length ? "<td class=\"cell-warn\" title=\"overridden\">⚠</td>" : "<td class=\"cell-ok\" title=\"ready\">✅</td>";
      }).join("") + "</tr>";
    }).join("");
    return "<table class=\"mini-grid\"><thead><tr><th></th><th>EN</th><th>DE</th><th>FR</th></tr></thead><tbody>" + rows + "</tbody></table>";
  }

  function draftBody(st, it, v, h) {
    var d = it.draft, html = "<div class=\"draft\" data-key=\"" + attr(it.key) + "\">";
    if (st.editing === it.key && d) {
      html += "<p class=\"hint\">Facts are locked as {{…}} tokens. Edit wording only.</p>" +
        "<textarea data-edit-area rows=\"10\">" + esc(d.template) + "</textarea>" +
        "<div class=\"actions\"><button class=\"btn\" data-action=\"edit-save\" data-key=\"" + attr(it.key) + "\">Save</button>" +
        "<button class=\"btn ghost\" data-action=\"edit-cancel\">Cancel</button></div>";
    } else {
      if (d && d.template != null) html += "<pre class=\"draft-text\">" + segmentsHtml(h.renderDraft(d, it.lang).segments) + "</pre>";
      var failing = it.failing;
      if (failing.length) {
        html += "<ul class=\"issues\">" + failing.map(function (c) { return "<li>❌ <strong>" + esc(c.id) + "</strong>: " + esc(c.message) + "</li>"; }).join("") + "</ul>";
      }
      if (it.overridden) html += "<p class=\"override-note\">⚠ Overridden: " + esc(d.override.reason) + "</p>";
      var fix = failing.filter(function (c) { return c.fix; })[0];
      var acts = "";
      if (fix) acts += "<button class=\"btn\" data-action=\"fix\" data-key=\"" + attr(it.key) + "\">Use record term</button>";
      if (d && d.template != null) acts += "<button class=\"btn ghost\" data-action=\"edit\" data-key=\"" + attr(it.key) + "\">Edit</button>";
      if (it.needs && d && d.template != null) acts += "<button class=\"btn ghost\" data-action=\"override\" data-key=\"" + attr(it.key) + "\">Override…</button>";
      if (acts) html += "<div class=\"actions\">" + acts + "</div>";
    }
    return html + "</div>";
  }

  function langRow(st, it, v, h) {
    var n = it.failing.length;
    var status = it.needs ? "<span class=\"bad\">❌ " + n + " issue" + (n === 1 ? "" : "s") + "</span>"
      : (n ? "<span class=\"warn\">⚠ overridden</span>" : "<span class=\"ok\">✅ same facts</span>");
    var open = !!st.expandedLang[it.key];
    return "<div class=\"lang-block\"><button class=\"lang-row\" data-action=\"toggle-lang\" data-key=\"" + attr(it.key) + "\" aria-expanded=\"" + open + "\">" +
      "<span class=\"caret\">" + (open ? "▾" : "▸") + "</span> <strong>" + it.lang + "</strong> " + status + "</button>" +
      (open ? draftBody(st, it, v, h) : "") + "</div>";
  }

  function card(st, r, v, h) {
    var open = !!st.expandedRoles[r.role];
    var needs = r.keys.filter(function (i) { return i.needs; }).length;
    var statusTxt = needs ? "<span class=\"bad\">❌ " + needs + " needs you</span>" : "<span class=\"ok\">✅ " + r.keys.length + " ready</span>";
    var approved = !!st.approved[r.role];
    var html = "<article class=\"card" + (approved ? " approved" : "") + "\" data-role=\"" + r.role + "\">" +
      "<div class=\"card-head\"><button class=\"card-toggle\" data-action=\"toggle-card\" data-role=\"" + r.role + "\" aria-expanded=\"" + open + "\">" +
      "<span class=\"caret\">" + (open ? "▾" : "▸") + "</span> <strong>" + L.roleName(r.role) + "</strong> " + statusTxt + "</button>" +
      "<button class=\"btn approve\" data-action=\"approve\" data-role=\"" + r.role + "\"" + (st.expandedOnce[r.role] && !approved ? "" : " disabled") + ">" +
      (approved ? "✅ Approved" : "Approve") + "</button></div>";
    if (open) {
      var en = r.keys.filter(function (i) { return i.lang === "EN"; })[0];
      html += "<div class=\"card-body\"><div class=\"en-block\"><h4>EN" + (en.reviewOnly ? " · review only" : "") + "</h4>" +
        (en.needs ? "" : "<p class=\"ok small\">✅ checks passed</p>") + draftBody(st, en, v, h) + "</div>";
      r.keys.filter(function (i) { return i.lang !== "EN"; }).forEach(function (i) { html += langRow(st, i, v, h); });
      html += "</div>";
    }
    return html + "</article>";
  }

  views.messages = function (st, v, h) {
    var html = "<div class=\"panel-head\"><h2>Stakeholder messages</h2><span class=\"label-badge\">" + esc(L.labelText(v.label, "EN", G)) + "</span></div>";
    if (v.sentThis) {
      return html + "<div class=\"banner banner-ok\" data-testid=\"sent-banner\">✅ " + esc(st.history[st.history.length - 1].label) +
        " sent to the outbox. Waiting for the next record update.</div>";
    }
    var diff = L.diffRecords(st.lastSent, st.record);
    if (diff.length) {
      html += "<div class=\"banner banner-info\" data-testid=\"diff-banner\"><strong>Changed since the last sent message:</strong><ul>" +
        diff.map(function (d) { return "<li>" + esc(changeText(d)) + "</li>"; }).join("") + "</ul></div>";
    }
    if (v.outdated) {
      html += "<div class=\"banner banner-warn banner-outdated\" data-testid=\"outdated-banner\">⚠ The record changed to v" + st.record.version +
        " while you were reviewing. Drafts are outdated and sending is disabled. " +
        "<button class=\"btn\" data-action=\"regenerate\">Regenerate drafts</button></div>";
    }
    html += recipientSummary(st, v);
    if (st.phase !== "ready") {
      return html + "<p class=\"gen-status\" role=\"status\">⏳ " + (st.phase === "writing" ? "Writing drafts…" : "Checking…") + "</p>";
    }
    html += "<div class=\"strip\"><span class=\"strip-text\"><span class=\"ok\">✅ " + v.ready + " ready</span> · <span class=\"" + (v.needs.length ? "bad" : "muted") + "\">❌ " +
      v.needs.length + " needs you</span></span>" +
      "<button class=\"btn\" data-action=\"next-issue\"" + (v.needs.length ? "" : " disabled") + ">Next issue (" + v.needs.length + ")</button>" +
      miniGrid(v) + "</div>";
    html += v.roles.map(function (r) { return card(st, r, v, h); }).join("");
    return html;
  };

  views.nextUpdate = function (st, v) {
    if (st.record.resolved || v.sentThis) return "";
    return "<label class=\"nu\">Next update by <input type=\"time\" data-nu value=\"" + attr(st.nextUpdate) + "\"></label>";
  };

  views.primary = function (st, v) {
    if (v.sentThis) return "";
    var p = v.primary;
    return "<button class=\"btn primary\" data-action=\"" + p.action + "\"" + (p.disabled ? " disabled" : "") + ">" + esc(p.label) + "</button>";
  };

  // ---------- History ----------
  views.history = function (st) {
    var html = "<h2>Outbox / history</h2>";
    if (!st.history.length) return html + "<p class=\"muted\">Nothing sent yet.</p>";
    return html + st.history.map(function (e, i) {
      var open = !!st.historyOpen[i];
      var ov = e.overrides.length
        ? "<ul class=\"ov-list\">" + e.overrides.map(function (o) {
          return "<li>⚠ Override " + L.roleName(o.role) + " " + o.lang + " (" + esc(o.checks.join(", ")) + "): " + esc(o.reason) + "</li>";
        }).join("") + "</ul>" : "";
      return "<article class=\"history-entry\"><h3>" + esc(e.label) + "</h3>" +
        "<p class=\"muted\">" + esc(e.time) + " · record v" + e.version + " · approved by " + esc(e.approver) + " · " + e.messages.length + " messages</p>" + ov +
        "<button class=\"link\" data-action=\"toggle-history\" data-idx=\"" + i + "\">" + (open ? "▾ Hide messages" : "▸ Show messages") + "</button>" +
        (open ? e.messages.map(function (m) {
          return "<div class=\"msg\"><div class=\"msg-to\">→ <strong>" + esc(m.recipient) + "</strong> <span class=\"muted\">" + L.roleName(m.role) + " · " + m.lang + "</span></div><pre>" + esc(m.text) + "</pre></div>";
        }).join("") : "") + "</article>";
    }).join("");
  };

  // ---------- Demo box + dialog ----------
  views.demo = function (st) {
    var last = st.versionIdx >= D.records.length - 1;
    return "<div class=\"demo-box\"><strong>Demo</strong><div class=\"muted small\">Record v" + st.record.version + " of " + D.records.length + "</div>" +
      "<button class=\"btn\" data-action=\"simulate\"" + (last ? " disabled" : "") + ">Simulate record update</button></div>";
  };

  views.dialog = function (st, v) {
    if (!st.dialog) return "";
    var it = v.items[st.dialog.key];
    return "<div class=\"modal-backdrop\"><div class=\"modal\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Override checks\">" +
      "<h3>Override checks</h3><p class=\"muted\">" + (it ? L.roleName(it.role) + " · " + it.lang : "") + "</p>" +
      (it ? "<ul class=\"issues\">" + it.failing.map(function (c) { return "<li>❌ " + esc(c.id) + ": " + esc(c.message) + "</li>"; }).join("") + "</ul>" : "") +
      "<label>Reason (at least 10 characters)<textarea data-reason rows=\"3\">" + esc(st.dialog.text || "") + "</textarea></label>" +
      (st.dialog.error ? "<p class=\"bad\" role=\"alert\">" + esc(st.dialog.error) + "</p>" : "") +
      "<div class=\"actions\"><button class=\"btn primary\" data-action=\"override-confirm\">Confirm override</button>" +
      "<button class=\"btn ghost\" data-action=\"override-cancel\">Cancel</button></div></div></div>";
  };

  SkyNet.ui.views = views;
})();
