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
  var attr = esc;
  function sysName(s) { return G["sys." + s] ? G["sys." + s].EN : s; }
  function statusEN(list) { return list ? G["status." + L.STATUS[list]].EN : "—"; }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

  function chip(text, field, was) {
    return "<span class=\"chip chip-" + attr(field || "plain") + "\">" + esc(text) + "</span>" +
      (was ? " <span class=\"was\">was " + esc(was) + "</span>" : "");
  }

  function changeText(d) {
    function v(x) { return x == null ? "—" : x; }
    if (d.field === "expected") return "Expected recovery: " + v(d.from) + " → " + v(d.to);
    if (d.field === "major") return "Major incident: " + (d.from ? "yes" : "no") + " → " + (d.to ? "yes" : "no");
    if (d.field === "resolved") return "Resolved: " + (d.from ? "yes" : "no") + " → " + (d.to ? "yes" : "no");
    return sysName(d.system) + ": " + statusEN(d.from) + " → " + statusEN(d.to);
  }

  function inboxItem(st, e) {
    var selected = st.selected === e.id ? " selected" : "";
    if (!e.live) {
      return "<li><button class=\"inbox-item" + selected + "\" data-action=\"select\" data-id=\"" + e.id + "\">" +
        "<span class=\"sev sev-minor\"></span><span class=\"inbox-main\"><span class=\"inbox-title\">" + esc(e.title) + "</span>" +
        "<span class=\"inbox-meta\">" + e.id + " · " + e.time + "</span></span><span class=\"badge badge-muted\">" + esc(e.state) + "</span></button></li>";
    }
    var r = st.record, sentThis = st.sentVersion === r.version, badge;
    if (st.unread) badge = "<span class=\"badge badge-new\">" + (st.history.length ? "Updated" : "New") + "</span>";
    else if (sentThis) badge = "<span class=\"badge badge-ok\">✔ Informed</span>";
    else badge = "<span class=\"badge badge-warn\">Action needed</span>";
    return "<li><button class=\"inbox-item" + selected + (st.unread ? " unread" : "") + "\" data-action=\"select\" data-id=\"" + e.id + "\">" +
      "<span class=\"sev " + (r.major ? "sev-major" : "sev-minor") + "\"></span><span class=\"inbox-main\"><span class=\"inbox-title\">" + esc(r.title) + "</span>" +
      "<span class=\"inbox-meta\">" + r.id + " · " + esc(r.updatedAt.slice(11)) + " · " + (r.major ? "Major" : "Minor") + "</span></span>" + badge + "</button></li>";
  };

  views.inbox = function (st) {
    return "<div class=\"inbox-head\"><h2>Inbox</h2><span class=\"count\">" + D.inbox.length + "</span></div>" +
      "<p class=\"inbox-sub\">Incoming incidents</p><ul class=\"inbox-list\">" + D.inbox.map(function (e) { return inboxItem(st, e); }).join("") + "</ul>";
  };

  // ---------- incident header + stepper ----------
  var STEPS = [["incident", "Incident"], ["recipients", "Recipients"], ["messages", "Messages"]];
  views.head = function (st, v) {
    var r = st.record, idx = v.sentThis ? 3 : STEPS.map(function (s) { return s[0]; }).indexOf(st.step);
    var stepper = "<ol class=\"stepper\">" + STEPS.map(function (s, i) {
      var cls = i < idx ? "done" : (i === idx ? "active" : "");
      return "<li class=\"" + cls + "\"><span class=\"step-no\">" + (i < idx ? "✔" : i + 1) + "</span>" + s[1] + "</li>";
    }).join("") + "</ol>";
    return "<div class=\"inc-title\"><span class=\"inc-id\">" + esc(r.id) + "</span><h1>" + esc(r.title) + "</h1>" +
      "<div class=\"inc-chips\">" + chip(r.major ? "Major incident" : "Minor incident", r.major ? "affected" : "plain") +
      (r.resolved ? chip("Resolved", "working") : "") +
      "<span class=\"muted small\">Record v" + r.version + " · updated " + esc(r.updatedAt.replace("T", " ")) + "</span></div></div>" + stepper;
  };

  // ---------- step 1: incident ----------
  function board(st) {
    var r = st.record, diff = L.diffRecords(st.lastSent, r), moved = {};
    diff.forEach(function (d) { if (d.field === "system") moved[d.system] = d.from; });
    var exp = diff.filter(function (d) { return d.field === "expected"; })[0];
    function col(title, key, cls) {
      var items = r[key].map(function (s) {
        return "<li>" + chip(sysName(s), key, moved[s] ? statusEN(moved[s]) : null) + "</li>";
      }).join("");
      return "<div class=\"board-col " + cls + "\"><h3>" + title + " <span class=\"count\">" + r[key].length + "</span></h3><ul>" + (items || "<li class=\"muted\">None</li>") + "</ul></div>";
    }
    return "<div class=\"board\">" + col("Unavailable", "affected", "col-affected") + col("Degraded", "degraded", "col-degraded") + col("Operational", "working", "col-working") + "</div>" +
      "<p class=\"expected\"><strong>Expected recovery</strong> " + chip(r.expected == null ? "—" : r.expected, "expected", exp ? (exp.from == null ? "—" : exp.from) : null) + "</p>";
  }

  function historyHtml(st) {
    if (!st.history.length) return "";
    return "<section class=\"history\"><h2>Sent to stakeholders</h2>" + st.history.slice().map(function (e, i) { return [e, i]; }).reverse().map(function (p) {
      var e = p[0], i = p[1], open = !!st.historyOpen[i];
      var ov = e.overrides.length
        ? "<ul class=\"ov-list\">" + e.overrides.map(function (o) {
          return "<li>⚠ Override " + L.roleName(o.role) + " " + o.lang + " (" + esc(o.checks.join(", ")) + "): " + esc(o.reason) + "</li>";
        }).join("") + "</ul>" : "";
      return "<article class=\"history-entry\"><h3>" + esc(e.label) + "</h3>" +
        "<p class=\"muted small\">" + esc(e.time) + " · record v" + e.version + " · approved by " + esc(e.approver) + " · " + plural(e.messages.length, "message") + "</p>" + ov +
        "<button class=\"link\" data-action=\"toggle-history\" data-idx=\"" + i + "\">" + (open ? "▾ Hide messages" : "▸ Show messages") + "</button>" +
        (open ? e.messages.map(function (m) {
          return "<div class=\"msg\"><div class=\"msg-to\">→ <strong>" + esc(m.recipient) + "</strong> <span class=\"muted\">" + L.roleName(m.role) + " · " + m.lang + "</span></div><pre>" + esc(m.text) + "</pre></div>";
        }).join("") : "") + "</article>";
    }).join("") + "</section>";
  }

  views.incidentStep = function (st, v) {
    var diff = L.diffRecords(st.lastSent, st.record), html = "";
    if (v.sentThis) {
      var last = st.history[st.history.length - 1];
      html += "<div class=\"banner banner-ok\" data-testid=\"sent-banner\">✅ <strong>" + esc(last.label) + "</strong> sent to " + plural(last.messages.length, "recipient") +
        " at " + esc(last.time) + ". Waiting for the next record update.</div>";
    } else if (diff.length) {
      html += "<div class=\"banner banner-info\" data-testid=\"diff-banner\"><strong>New since the last message to stakeholders</strong><ul>" +
        diff.map(function (d) { return "<li>" + esc(changeText(d)) + "</li>"; }).join("") + "</ul></div>";
    } else if (!st.history.length) {
      html += "<div class=\"banner banner-warn\">Stakeholders have not been informed about this incident yet.</div>";
    }
    html += board(st);
    if (!v.sentThis) {
      var k = v.label.kind;
      var text = k === "initial" ? "Inform stakeholders" : (k === "resolved" ? "Send resolution notice" : "Send update to stakeholders");
      html += "<div class=\"cta\"><button class=\"btn primary big\" data-action=\"inform\">" + text + "</button>" +
        "<span class=\"muted\">Next: review who will be contacted.</span></div>";
    }
    return html + historyHtml(st);
  };

  // ---------- step 2: recipients ----------
  views.recipientsStep = function (st, v) {
    var r = st.record, o = st.overrides, ids = v.recipients.map(function (c) { return c.id; });
    var langs = [];
    v.recipients.forEach(function (c) { if (langs.indexOf(c.lang) < 0) langs.push(c.lang); });
    langs.sort();
    var html = "<h2>Who will be informed</h2><p class=\"lead\">Suggested from the role rules for a " + (r.major ? "<strong>major</strong>" : "<strong>non-major</strong>") +
      " incident. Tick or untick people to change who is contacted.</p>";
    L.ROLE_ORDER.forEach(function (role) {
      var rule = D.roleRules[role], notified = rule.notified === "always" || r.major;
      var reason = rule.notified === "always" ? "Always notified" : (r.major ? "Notified because this is a major incident" : "Not notified for non-major incidents");
      var people = D.contacts.filter(function (c) { return c.role === role; });
      var n = people.filter(function (c) { return ids.indexOf(c.id) >= 0; }).length;
      html += "<section class=\"role-group" + (notified ? "" : " dim") + "\"><div class=\"role-head\"><h3>" + L.roleName(role) + "</h3><span class=\"muted small\">" + esc(reason) + "</span>" +
        "<span class=\"count\">" + n + "</span></div><ul class=\"people\">" + people.map(function (c) {
        var on = ids.indexOf(c.id) >= 0, tag = "";
        if (!c.active) tag = "<span class=\"tag\">inactive</span>";
        else if (o.added.indexOf(c.id) >= 0 && on) tag = "<span class=\"tag tag-add\">added by you</span>";
        else if (o.removed.indexOf(c.id) >= 0) tag = "<span class=\"tag tag-rem\">removed by you</span>";
        return "<li><label class=\"person\"><input type=\"checkbox\" data-action=\"toggle-recipient\" data-id=\"" + c.id + "\"" + (on ? " checked" : "") + (c.active ? "" : " disabled") + ">" +
          "<span class=\"avatar\">" + esc(c.name.split(" ").map(function (w) { return w[0]; }).join("")) + "</span>" +
          "<span class=\"person-name\">" + esc(c.name) + "</span><span class=\"lang\">" + c.lang + "</span>" + tag + "</label></li>";
      }).join("") + "</ul></section>";
    });
    html += "<div class=\"summary-bar\"><span><strong>" + (v.recipients.length === 1 ? "1 person" : v.recipients.length + " people") + "</strong> will be contacted" +
      (langs.length ? " in " + langs.join(", ") : "") + ". You also get an English review copy per role.</span>" +
      "<span class=\"actions\"><button class=\"btn ghost\" data-action=\"back-incident\">← Back</button>" +
      "<button class=\"btn primary\" data-action=\"generate\"" + (v.recipients.length ? "" : " disabled") + ">Generate messages</button></span></div>";
    return html;
  };

  // ---------- step 3: messages ----------
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
        if (it.needs) return "<td title=\"needs you\">❌</td>";
        return it.failing.length ? "<td title=\"overridden\">⚠</td>" : "<td title=\"ready\">✅</td>";
      }).join("") + "</tr>";
    }).join("");
    return "<table class=\"mini-grid\"><thead><tr><th></th><th>EN</th><th>DE</th><th>FR</th></tr></thead><tbody>" + rows + "</tbody></table>";
  }

  function draftBody(st, it, h) {
    var d = it.draft, html = "<div class=\"draft\" data-key=\"" + attr(it.key) + "\">";
    if (st.editing === it.key && d) {
      html += "<p class=\"hint\">Facts are locked as {{…}} tokens. Edit wording only.</p>" +
        "<textarea data-edit-area rows=\"10\">" + esc(d.template) + "</textarea>" +
        "<div class=\"actions\"><button class=\"btn\" data-action=\"edit-save\" data-key=\"" + attr(it.key) + "\">Save</button>" +
        "<button class=\"btn ghost\" data-action=\"edit-cancel\">Cancel</button></div>";
    } else {
      if (d && d.template != null) html += "<pre class=\"draft-text\">" + segmentsHtml(h.renderDraft(d, it.lang).segments) + "</pre>";
      if (it.failing.length) {
        html += "<ul class=\"issues\">" + it.failing.map(function (c) { return "<li>❌ <strong>" + esc(c.id) + "</strong>: " + esc(c.message) + "</li>"; }).join("") + "</ul>";
      }
      if (it.overridden) html += "<p class=\"override-note\">⚠ Overridden: " + esc(d.override.reason) + "</p>";
      var fix = it.failing.filter(function (c) { return c.fix; })[0], acts = "";
      if (fix) acts += "<button class=\"btn\" data-action=\"fix\" data-key=\"" + attr(it.key) + "\">Use record term</button>";
      if (d && d.template != null) acts += "<button class=\"btn ghost\" data-action=\"edit\" data-key=\"" + attr(it.key) + "\">Edit</button>";
      if (it.needs && d && d.template != null) acts += "<button class=\"btn ghost\" data-action=\"override\" data-key=\"" + attr(it.key) + "\">Override…</button>";
      if (acts) html += "<div class=\"actions\">" + acts + "</div>";
    }
    return html + "</div>";
  }

  function langRow(st, it, h) {
    var n = it.failing.length;
    var status = it.needs ? "<span class=\"bad\">❌ " + plural(n, "issue") + "</span>"
      : (n ? "<span class=\"warn\">⚠ overridden</span>" : "<span class=\"ok\">✅ same facts</span>");
    var open = !!st.expandedLang[it.key];
    return "<div class=\"lang-block\"><button class=\"lang-row\" data-action=\"toggle-lang\" data-key=\"" + attr(it.key) + "\" aria-expanded=\"" + open + "\">" +
      "<span class=\"caret\">" + (open ? "▾" : "▸") + "</span> <strong>" + it.lang + "</strong> " + status + "</button>" +
      (open ? draftBody(st, it, h) : "") + "</div>";
  }

  function card(st, r, h) {
    var open = !!st.expandedRoles[r.role], approved = !!st.approved[r.role];
    var needs = r.keys.filter(function (i) { return i.needs; }).length;
    var recips = r.keys.filter(function (i) { return !i.reviewOnly; }).length;
    var statusTxt = needs ? "<span class=\"bad\">❌ " + needs + " needs you</span>" : "<span class=\"ok\">✅ " + r.keys.length + " ready</span>";
    var html = "<article class=\"card" + (approved ? " approved" : "") + "\" data-role=\"" + r.role + "\">" +
      "<div class=\"card-head\"><button class=\"card-toggle\" data-action=\"toggle-card\" data-role=\"" + r.role + "\" aria-expanded=\"" + open + "\">" +
      "<span class=\"caret\">" + (open ? "▾" : "▸") + "</span> <strong>" + L.roleName(r.role) + "</strong>" +
      "<span class=\"muted small\">" + plural(recips, "language") + "</span> " + statusTxt + "</button>" +
      "<button class=\"btn approve\" data-action=\"approve\" data-role=\"" + r.role + "\"" + (st.expandedOnce[r.role] && !approved ? "" : " disabled") + ">" +
      (approved ? "✅ Approved" : "Approve") + "</button></div>";
    if (open) {
      var en = r.keys.filter(function (i) { return i.lang === "EN"; })[0];
      html += "<div class=\"card-body\"><div class=\"en-block\"><h4>EN" + (en.reviewOnly ? " · review only" : "") + "</h4>" +
        (en.needs ? "" : "<p class=\"ok small\">✅ checks passed</p>") + draftBody(st, en, h) + "</div>";
      r.keys.filter(function (i) { return i.lang !== "EN"; }).forEach(function (i) { html += langRow(st, i, h); });
      html += "</div>";
    }
    return html + "</article>";
  }

  views.messages = function (st, v, h) {
    var html = "<div class=\"msg-head\"><h2>Review and approve messages</h2><span class=\"label-badge\">" + esc(L.labelText(v.label, "EN", G)) + "</span></div>";
    var diff = L.diffRecords(st.lastSent, st.record);
    if (diff.length) {
      html += "<div class=\"banner banner-info\" data-testid=\"diff-banner\"><strong>Changed since the last sent message</strong><ul>" +
        diff.map(function (d) { return "<li>" + esc(changeText(d)) + "</li>"; }).join("") + "</ul></div>";
    }
    if (v.outdated) {
      html += "<div class=\"banner banner-warn\" data-testid=\"outdated-banner\">⚠ The record changed to v" + st.record.version +
        " while you were reviewing. Drafts are outdated and sending is disabled. " +
        "<button class=\"btn\" data-action=\"regenerate\">Regenerate drafts</button></div>";
    }
    html += recipientSummary(st, v);
    if (st.phase !== "ready") {
      return html + "<p class=\"gen-status\" role=\"status\"><span class=\"spinner\"></span>" + (st.phase === "writing" ? "Writing drafts…" : "Checking…") + "</p>";
    }
    html += "<div class=\"strip\"><span class=\"strip-text\"><span class=\"ok\">✅ " + v.ready + " ready</span> · <span class=\"" + (v.needs.length ? "bad" : "muted") + "\">❌ " +
      v.needs.length + " needs you</span></span>" +
      "<button class=\"btn\" data-action=\"next-issue\"" + (v.needs.length ? "" : " disabled") + ">Next issue (" + v.needs.length + ")</button>" +
      miniGrid(v) + "</div>";
    return html + v.roles.map(function (r) { return card(st, r, h); }).join("");
  };

  views.nextUpdate = function (st) {
    if (st.step !== "messages" || st.record.resolved) return "";
    return "<label class=\"nu\">Next update by <input type=\"time\" data-nu value=\"" + attr(st.nextUpdate) + "\"></label>";
  };

  views.primary = function (st, v) {
    if (st.step !== "messages") return "";
    var p = v.primary;
    return "<button class=\"btn primary\" data-action=\"" + p.action + "\"" + (p.disabled ? " disabled" : "") + ">" + esc(p.label) + "</button>";
  };

  views.placeholder = function (e) {
    return "<div class=\"inc-title\"><span class=\"inc-id\">" + e.id + "</span><h1>" + esc(e.title) + "</h1></div>" +
      "<div class=\"banner banner-info\">" + esc(e.note) + "</div><p class=\"muted\">Placeholder entry for the demo. Select INC00123 to try the stakeholder flow.</p>";
  };

  views.demo = function (st) {
    var last = st.versionIdx >= D.records.length - 1;
    return "<div class=\"demo-box\"><strong>Demo</strong><div class=\"muted small\">INC00123 record v" + st.record.version + " of " + D.records.length + "</div>" +
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
