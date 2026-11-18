window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
// Pure view functions: state + derived view -> HTML string.
(function () {
  var D = SkyNet.data, L = SkyNet.lib, G = D.glossary;
  var views = {};

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
    });
  }
  var attr = esc;
  function sysName(s) { return G["sys." + s] ? G["sys." + s].EN : s; }
  function statusEN(list) { return list ? G["status." + L.STATUS[list]].EN : "—"; }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function peopleText(n) { return n === 1 ? "1 person" : n + " people"; }
  function initials(name) { return name.split(" ").map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase(); }

  // One drawn icon set: 24px grid, 1.75 stroke, round caps.
  var ICONS = {
    inbox: "<path d=\"M3 13l2.4-7.2A2 2 0 0 1 7.3 4.4h9.4a2 2 0 0 1 1.9 1.4L21 13\"/><path d=\"M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5l-1.5 2.5h-5L8 13H3z\"/>",
    users: "<circle cx=\"9\" cy=\"8\" r=\"3.2\"/><path d=\"M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6\"/><path d=\"M16.5 4.9a3.2 3.2 0 0 1 0 6.2M18.7 14.4c1.5.9 2.3 2.5 2.3 4.6\"/>",
    check: "<path d=\"M5 12.5l4.5 4.5L19 7.5\"/>",
    "check-circle": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12.3l2.6 2.6L16 9.5\"/>",
    alert: "<path d=\"M12 4l9 16H3L12 4z\"/><path d=\"M12 10v4M12 17.2v.1\"/>",
    "x-circle": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9 9l6 6M15 9l-6 6\"/>",
    "chevron-right": "<path d=\"M9 6l6 6-6 6\"/>",
    "chevron-down": "<path d=\"M6 9l6 6 6-6\"/>",
    "arrow-left": "<path d=\"M19 12H5M11 6l-6 6 6 6\"/>",
    plus: "<path d=\"M12 5v14M5 12h14\"/>",
    edit: "<path d=\"M4 20h4L19 9l-4-4L4 16v4z\"/><path d=\"M13.5 6.5l4 4\"/>",
    trash: "<path d=\"M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5\"/>",
    send: "<path d=\"M21 3L10 14\"/><path d=\"M21 3l-6.5 18-4-7.5L3 9.5 21 3z\"/>",
    clock: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
    radar: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"4.5\"/><path d=\"M12 12l6.3-6.3\"/>",
    globe: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c3.2 3.4 3.2 14.6 0 18M12 3c-3.2 3.4-3.2 14.6 0 18\"/>",
    dot: "<circle cx=\"12\" cy=\"12\" r=\"3\"/>"
  };
  function ic(name, cls) {
    return "<svg class=\"ic" + (cls ? " " + cls : "") + "\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + ICONS[name] + "</svg>";
  }
  views.icon = ic;

  function chip(text, field, was) {
    return "<span class=\"chip chip-" + attr(field || "plain") + "\">" + esc(text) + "</span>" +
      (was ? " <span class=\"was\">was " + esc(was) + "</span>" : "");
  }
  function sevPill(major) {
    return "<span class=\"sev-pill " + (major ? "sev-major" : "sev-minor") + "\">" + (major ? "Major" : "Minor") + "</span>";
  }

  function changeText(d) {
    function v(x) { return x == null ? "—" : x; }
    if (d.field === "expected") return "Expected recovery: " + v(d.from) + " → " + v(d.to);
    if (d.field === "major") return "Major incident: " + (d.from ? "yes" : "no") + " → " + (d.to ? "yes" : "no");
    if (d.field === "resolved") return "Resolved: " + (d.from ? "yes" : "no") + " → " + (d.to ? "yes" : "no");
    return sysName(d.system) + ": " + statusEN(d.from) + " → " + statusEN(d.to);
  }

  function lastEntry(st) { return st.history.length ? st.history[st.history.length - 1] : null; }
  function confirmedCount(entry) { return entry.messages.filter(function (m) { return m.status === "confirmed"; }).length; }

  // ---------- rail ----------
  views.rail = function (st) {
    var actionNeeded = st.sentVersion !== st.record.version ? 1 : 0;
    function nav(view, icon, label, count) {
      return "<button class=\"nav-item" + (st.view === view ? " active" : "") + "\" data-action=\"nav\" data-view=\"" + view + "\"" + (st.view === view ? " aria-current=\"page\"" : "") + ">" +
        ic(icon) + "<span>" + label + "</span>" + (count ? "<span class=\"nav-count\">" + count + "</span>" : "") + "</button>";
    }
    var langs = L.LANG_ORDER.map(function (l) {
      return "<button class=\"seg" + (st.opLang === l ? " on" : "") + "\" data-action=\"set-lang\" data-lang=\"" + l + "\" aria-pressed=\"" + (st.opLang === l) + "\">" + l + "</button>";
    }).join("");
    return "<div class=\"brand\">" + ic("radar", "brand-mark") + "<div><strong>SkyNet</strong><span>SMC console</span></div></div>" +
      "<div class=\"nav\">" + nav("incidents", "inbox", "Incidents", actionNeeded) + nav("stakeholders", "users", "Stakeholders", st.contacts.filter(function (c) { return c.active; }).length) + "</div>" + views.demo(st) +
      "<div class=\"rail-foot\"><div class=\"lang-ctl\"><span class=\"lang-label\">" + ic("globe") + "Operator language</span><div class=\"segmented\" role=\"group\" aria-label=\"Operator language\">" + langs + "</div></div>" +
      "<div class=\"operator\"><span class=\"avatar sm\">SO</span><span>SMC operator</span></div></div>";
  };

  // ---------- incident list ----------
  function inboxItem(st, e) {
    var selected = st.selected === e.id ? " selected" : "";
    if (!e.live) {
      return "<li><button class=\"inbox-item" + selected + "\" data-action=\"select\" data-id=\"" + e.id + "\">" + sevPill(false) +
        "<span class=\"ii-main\"><span class=\"ii-top\"><span class=\"ii-id\">" + e.id + "</span><span class=\"ii-time\">" + e.time + "</span></span>" +
        "<span class=\"ii-title\">" + esc(e.title) + "</span>" +
        "<span class=\"ii-bottom\"><span class=\"badge badge-muted\">" + esc(e.state) + "</span></span></span></button></li>";
    }
    var r = st.record, sentThis = st.sentVersion === r.version, badge, conf = "";
    if (st.unread) badge = "<span class=\"badge badge-new\">" + (st.history.length ? "Updated" : "New") + "</span>";
    else if (sentThis) {
      badge = "<span class=\"badge badge-ok\">Informed</span>";
      var le = lastEntry(st);
      conf = "<span class=\"conf\">" + confirmedCount(le) + "/" + le.messages.length + " confirmed</span>";
    } else badge = "<span class=\"badge badge-warn\">Action needed</span>";
    return "<li><button class=\"inbox-item" + selected + (st.unread ? " unread" : "") + "\" data-action=\"select\" data-id=\"" + e.id + "\">" + sevPill(r.major) +
      "<span class=\"ii-main\"><span class=\"ii-top\"><span class=\"ii-id\">" + r.id + "</span><span class=\"ii-time\">" + esc(r.updatedAt.slice(11)) + "</span></span>" +
      "<span class=\"ii-title\">" + esc(r.title) + "</span>" +
      "<span class=\"ii-bottom\">" + badge + (r.resolved ? "<span class=\"badge badge-muted\">Resolved</span>" : "") + conf + "</span></span></button></li>";
  }

  views.inbox = function (st) {
    return "<div class=\"pane-head\"><h2>Incidents</h2><span class=\"count\">" + D.inbox.length + "</span></div>" +
      "<ul class=\"inbox-list\">" + D.inbox.map(function (e) { return inboxItem(st, e); }).join("") + "</ul>";
  };

  // ---------- incident header + stepper ----------
  var STEPS = [["incident", "Incident"], ["recipients", "Recipients"], ["messages", "Messages"]];
  views.head = function (st, v) {
    var r = st.record, idx = v.sentThis ? 3 : STEPS.map(function (s) { return s[0]; }).indexOf(st.step);
    var stepper = "<ol class=\"stepper\">" + STEPS.map(function (s, i) {
      var cls = i < idx ? "done" : (i === idx ? "active" : "");
      return "<li class=\"" + cls + "\"" + (i === idx ? " aria-current=\"step\"" : "") + "><span class=\"step-no\">" + (i < idx ? ic("check") : i + 1) + "</span>" + s[1] + "</li>";
    }).join("") + "</ol>";
    return "<div class=\"inc-title\"><div class=\"inc-line\"><h1>" + esc(r.title) + "</h1>" + sevPill(r.major) + (r.resolved ? "<span class=\"sev-pill sev-done\">Resolved</span>" : "") + "</div>" +
      "<p class=\"inc-meta\">" + esc(r.id) + " · record v" + r.version + " · updated <span class=\"num\">" + esc(r.updatedAt.replace("T", " ")) + "</span></p></div>" + stepper;
  };

  // ---------- step 1: incident ----------
  function board(st) {
    var r = st.record, diff = L.diffRecords(st.lastSent, r), moved = {};
    diff.forEach(function (d) { if (d.field === "system") moved[d.system] = d.from; });
    var exp = diff.filter(function (d) { return d.field === "expected"; })[0];
    function col(title, key, cls) {
      var items = r[key].map(function (s) { return "<li>" + chip(sysName(s), key, moved[s] ? statusEN(moved[s]) : null) + "</li>"; }).join("");
      return "<div class=\"board-col " + cls + "\"><h3>" + title + "<span class=\"count\">" + r[key].length + "</span></h3><ul>" + (items || "<li class=\"muted\">None</li>") + "</ul></div>";
    }
    return "<div class=\"board\">" + col("Unavailable", "affected", "col-affected") + col("Degraded", "degraded", "col-degraded") + col("Operational", "working", "col-working") + "</div>" +
      "<p class=\"expected\"><span class=\"muted\">Expected recovery</span> " + chip(r.expected == null ? "—" : r.expected, "expected", exp ? (exp.from == null ? "—" : exp.from) : null) + "</p>";
  }

  var STATUS_LABEL = { sent: "Sent", delivered: "Delivered", confirmed: "Confirmed" };
  var STATUS_ICON = { sent: "send", delivered: "check", confirmed: "check-circle" };
  function statusBadge(m) {
    var t = m.status === "confirmed" ? m.confirmedAt : (m.status === "delivered" ? m.deliveredAt : m.sentAt);
    return "<span class=\"dl dl-" + m.status + "\">" + ic(STATUS_ICON[m.status]) + STATUS_LABEL[m.status] + (t ? " <span class=\"num\">" + esc(t) + "</span>" : "") + "</span>";
  }

  function deliveryHtml(st) {
    var e = lastEntry(st);
    if (!e) return "";
    var i = st.history.length - 1, done = confirmedCount(e), total = e.messages.length;
    var pct = total ? Math.round(done * 100 / total) : 0;
    return "<section class=\"section delivery\"><div class=\"sec-head\"><h2>Delivery</h2><span class=\"muted\">" + esc(e.label) + " · sent <span class=\"num\">" + esc(e.time) + "</span></span></div>" +
      "<div class=\"d-summary\"><span class=\"pips\" aria-hidden=\"true\">" + e.messages.map(function (m) { return "<i class=\"pip pip-" + m.status + "\"></i>"; }).join("") + "</span>" +
      "<strong class=\"d-count\">" + done + " of " + total + " confirmed</strong></div>" +
      "<table class=\"table\"><thead><tr><th>Recipient</th><th>Role</th><th>Language</th><th>Status</th><th></th></tr></thead><tbody>" +
      e.messages.map(function (m, j) {
        return "<tr><td><span class=\"person-cell\"><span class=\"avatar sm\">" + esc(initials(m.recipient)) + "</span>" + esc(m.recipient) + "</span></td><td>" + L.roleName(m.role) + "</td><td><span class=\"lang\">" + m.lang + "</span></td>" +
          "<td>" + statusBadge(m) + "</td><td class=\"t-actions\">" +
          (m.status !== "confirmed" ? "<button class=\"btn sm\" data-action=\"confirm-msg\" data-h=\"" + i + "\" data-m=\"" + j + "\">Mark confirmed</button>" : "") + "</td></tr>";
      }).join("") + "</tbody></table></section>";
  }

  function historyHtml(st) {
    if (!st.history.length) return "";
    return "<section class=\"section history\"><div class=\"sec-head\"><h2>Sent messages</h2></div>" + st.history.map(function (e, i) { return [e, i]; }).reverse().map(function (p) {
      var e = p[0], i = p[1], open = !!st.historyOpen[i];
      var ov = e.overrides.length
        ? "<ul class=\"ov-list\">" + e.overrides.map(function (o) {
          return "<li>" + ic("alert") + "Override " + L.roleName(o.role) + " " + o.lang + " (" + esc(o.checks.join(", ")) + "): " + esc(o.reason) + "</li>";
        }).join("") + "</ul>" : "";
      return "<article class=\"history-entry\"><div class=\"he-head\"><h3>" + esc(e.label) + "</h3><span class=\"muted small\"><span class=\"num\">" + esc(e.time) + "</span> · record v" + e.version + " · approved by " + esc(e.approver) +
        " · " + plural(e.messages.length, "message") + " · " + confirmedCount(e) + " confirmed</span></div>" + ov +
        "<button class=\"link\" data-action=\"toggle-history\" data-idx=\"" + i + "\">" + ic(open ? "chevron-down" : "chevron-right") + (open ? "Hide messages" : "Show messages") + "</button>" +
        (open ? e.messages.map(function (m) {
          return "<div class=\"msg\"><div class=\"msg-to\"><strong>" + esc(m.recipient) + "</strong> <span class=\"muted\">" + L.roleName(m.role) + " · " + m.lang + "</span> " + statusBadge(m) + "</div><pre>" + esc(m.text) + "</pre></div>";
        }).join("") : "") + "</article>";
    }).join("") + "</section>";
  }

  views.incidentStep = function (st, v) {
    var diff = L.diffRecords(st.lastSent, st.record), html = "";
    if (v.sentThis) {
      var last = lastEntry(st);
      html += "<div class=\"banner banner-ok\" data-testid=\"sent-banner\">" + ic("check-circle") + "<div><strong>" + esc(last.label) + "</strong> sent to " + plural(last.messages.length, "recipient") +
        " at <span class=\"num\">" + esc(last.time) + "</span>. Waiting for the next record update.</div></div>";
    } else if (diff.length) {
      html += "<div class=\"banner banner-info\" data-testid=\"diff-banner\">" + ic("alert") + "<div><strong>New since the last message to stakeholders</strong><ul>" +
        diff.map(function (d) { return "<li>" + esc(changeText(d)) + "</li>"; }).join("") + "</ul></div></div>";
    } else if (!st.history.length) {
      html += "<div class=\"banner banner-warn\">" + ic("alert") + "<div>Stakeholders have not been informed about this incident yet.</div></div>";
    }
    html += board(st);
    if (!v.sentThis) {
      var k = v.label.kind;
      var text = k === "initial" ? "Inform stakeholders" : (k === "resolved" ? "Send resolution notice" : "Send update to stakeholders");
      html += "<div class=\"cta\"><button class=\"btn primary big\" data-action=\"inform\">" + ic("send") + text + "</button></div>";
    }
    return html + deliveryHtml(st) + historyHtml(st);
  };

  // ---------- step 2: recipients ----------
  function hasTemplate(st, role, lang) {
    return D.drafts.some(function (d) { return d.recordVersion === st.record.version && d.role === role && d.lang === lang; });
  }

  views.recipientsStep = function (st, v) {
    var r = st.record, o = st.overrides, ids = v.recipients.map(function (c) { return c.id; });
    var langs = [];
    v.recipients.forEach(function (c) { if (langs.indexOf(c.lang) < 0) langs.push(c.lang); });
    langs.sort();
    var html = "<div class=\"sec-head\"><h2>Who will be informed</h2><button class=\"btn sm ghost\" data-action=\"nav\" data-view=\"stakeholders\">" + ic("users") + "Manage stakeholders</button></div>";
    L.ROLE_ORDER.forEach(function (role) {
      var rule = D.roleRules[role], notified = rule.notified === "always" || r.major;
      var reason = rule.notified === "always" ? "Always notified" : (r.major ? "Notified because this is a major incident" : "Not notified for non-major incidents");
      var people = st.contacts.filter(function (c) { return c.role === role; });
      var n = people.filter(function (c) { return ids.indexOf(c.id) >= 0; }).length;
      html += "<section class=\"role-group" + (notified ? "" : " dim") + "\"><div class=\"role-head\"><h3>" + L.roleName(role) + "</h3><span class=\"muted small\">" + esc(reason) + "</span>" +
        "<span class=\"count\">" + n + "</span></div><ul class=\"people\">" + (people.map(function (c) {
          var on = ids.indexOf(c.id) >= 0, tag = "";
          if (!c.active) tag = "<span class=\"tag\">inactive</span>";
          else if (o.added.indexOf(c.id) >= 0 && on) tag = "<span class=\"tag tag-add\">added by you</span>";
          else if (o.removed.indexOf(c.id) >= 0) tag = "<span class=\"tag tag-rem\">removed by you</span>";
          if (on && !hasTemplate(st, role, c.lang)) tag += "<span class=\"tag tag-rem\">no " + c.lang + " template</span>";
          return "<li><label class=\"person\"><input type=\"checkbox\" data-action=\"toggle-recipient\" data-id=\"" + c.id + "\"" + (on ? " checked" : "") + (c.active ? "" : " disabled") + ">" +
            "<span class=\"avatar\">" + esc(initials(c.name)) + "</span><span class=\"person-name\">" + esc(c.name) + "</span><span class=\"lang\">" + c.lang + "</span>" + tag + "</label></li>";
        }).join("") || "<li class=\"muted small empty\">No stakeholders with this role.</li>") + "</ul></section>";
    });
    return html + "<div class=\"summary-bar\"><span><strong>" + peopleText(v.recipients.length) + "</strong> will be contacted" + (langs.length ? " in " + langs.join(", ") : "") + "</span>" +
      "<span class=\"actions\"><button class=\"btn ghost\" data-action=\"back-incident\">" + ic("arrow-left") + "Back</button>" +
      "<button class=\"btn primary\" data-action=\"generate\"" + (v.recipients.length ? "" : " disabled") + ">Generate messages</button></span></div>";
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
      var prev = L.getRecipients(st.lastSent, st.contacts, D.roleRules, st.overrides).map(function (c) { return c.role; });
      var cur = v.recipients.map(function (c) { return c.role; });
      L.ROLE_ORDER.forEach(function (role) {
        if (cur.indexOf(role) >= 0 && prev.indexOf(role) < 0) parts.push(L.roleName(role) + " added");
        if (cur.indexOf(role) < 0 && prev.indexOf(role) >= 0) parts.push(L.roleName(role) + " removed");
      });
    }
    var html = "<div class=\"recipients\"><button class=\"link\" data-action=\"toggle-recipients\" aria-expanded=\"" + !!st.recipientsOpen + "\">" +
      ic(st.recipientsOpen ? "chevron-down" : "chevron-right") + esc(parts.join(" · ")) + "</button>";
    if (st.recipientsOpen) {
      html += "<ul class=\"recipient-list\">" + st.contacts.map(function (c) {
        var on = v.recipients.some(function (x) { return x.id === c.id; });
        return "<li><label><input type=\"checkbox\" data-action=\"toggle-recipient\" data-id=\"" + c.id + "\"" + (on ? " checked" : "") + (c.active ? "" : " disabled") + "> " +
          esc(c.name) + " <span class=\"muted\">" + L.roleName(c.role) + " · " + c.lang + (c.active ? "" : " · inactive") + "</span></label></li>";
      }).join("") + "</ul>";
    }
    return html + "</div>";
  }

  function cellIcon(it) {
    if (!it) return "<td class=\"cell-none\">·</td>";
    if (it.needs) return "<td class=\"cell-bad\" title=\"needs you\">" + ic("x-circle") + "</td>";
    return it.failing.length ? "<td class=\"cell-warn\" title=\"overridden\">" + ic("alert") + "</td>" : "<td class=\"cell-ok\" title=\"ready\">" + ic("check-circle") + "</td>";
  }
  function miniGrid(v) {
    var short = { ATCO_SUPERVISOR: "ATCO", ENGINEERING: "ENG", MANAGEMENT: "MGMT" };
    var rows = v.roles.map(function (r) {
      return "<tr><th>" + short[r.role] + "</th>" + L.LANG_ORDER.map(function (lang) { return cellIcon(v.items[r.role + ":" + lang]); }).join("") + "</tr>";
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
        html += "<ul class=\"issues\">" + it.failing.map(function (c) { return "<li>" + ic("x-circle") + "<span><strong>" + esc(c.id) + "</strong>: " + esc(c.message) + "</span></li>"; }).join("") + "</ul>";
      }
      if (it.overridden) html += "<p class=\"override-note\">" + ic("alert") + "Overridden: " + esc(d.override.reason) + "</p>";
      var fix = it.failing.filter(function (c) { return c.fix; })[0], acts = "";
      if (fix) acts += "<button class=\"btn\" data-action=\"fix\" data-key=\"" + attr(it.key) + "\">Use record term</button>";
      if (d && d.template != null) acts += "<button class=\"btn ghost\" data-action=\"edit\" data-key=\"" + attr(it.key) + "\">" + ic("edit") + "Edit</button>";
      if (it.needs && d && d.template != null) acts += "<button class=\"btn ghost\" data-action=\"override\" data-key=\"" + attr(it.key) + "\">Override…</button>";
      if (acts) html += "<div class=\"actions\">" + acts + "</div>";
    }
    return html + "</div>";
  }

  // One column per language, shown side by side so wording and facts can be compared at a glance.
  function langCol(st, it, h) {
    var n = it.failing.length;
    var status = it.needs ? "<span class=\"bad\">" + ic("x-circle") + plural(n, "issue") + "</span>"
      : (n ? "<span class=\"warn\">" + ic("alert") + "overridden</span>"
        : "<span class=\"ok\">" + ic("check-circle") + (it.review ? "checks passed" : "same facts") + "</span>");
    var title = it.lang + (it.review ? (it.reviewOnly ? " · review only" : " · review") : "");
    return "<section class=\"lang-col" + (it.review ? " is-review" : "") + (it.needs ? " has-issue" : "") + "\" data-lang=\"" + it.lang + "\">" +
      "<header class=\"lang-head\"><strong>" + title + "</strong>" + status + "</header>" + draftBody(st, it, h) + "</section>";
  }

  function card(st, r, h) {
    var open = !!st.expandedRoles[r.role], approved = !!st.approved[r.role];
    var needs = r.keys.filter(function (i) { return i.needs; }).length;
    var recips = r.keys.filter(function (i) { return !i.reviewOnly; }).length;
    var statusTxt = needs ? "<span class=\"bad\">" + ic("x-circle") + needs + " needs you</span>" : "<span class=\"ok\">" + ic("check-circle") + r.keys.length + " ready</span>";
    var html = "<article class=\"card" + (approved ? " approved" : "") + "\" data-role=\"" + r.role + "\">" +
      "<div class=\"card-head\"><button class=\"card-toggle\" data-action=\"toggle-card\" data-role=\"" + r.role + "\" aria-expanded=\"" + open + "\">" +
      ic(open ? "chevron-down" : "chevron-right") + "<strong>" + L.roleName(r.role) + "</strong>" +
      "<span class=\"muted small\">" + plural(recips, "language") + "</span>" + statusTxt + "</button>" +
      "<button class=\"btn approve" + (approved ? " done" : "") + "\" data-action=\"approve\" data-role=\"" + r.role + "\"" + (st.expandedOnce[r.role] && !approved ? "" : " disabled") + ">" +
      (approved ? ic("check") + "Approved" : "Approve") + "</button></div>";
    if (open) {
      var ordered = r.keys.filter(function (i) { return i.review; }).concat(r.keys.filter(function (i) { return !i.review; }));
      html += "<div class=\"card-body\"><div class=\"lang-grid\" style=\"--cols:" + ordered.length + "\">" + ordered.map(function (i) { return langCol(st, i, h); }).join("") + "</div></div>";
    }
    return html + "</article>";
  }

  views.messages = function (st, v, h) {
    var html = "<div class=\"sec-head\"><h2>Review and approve messages</h2><span class=\"label-badge\">" + esc(L.labelText(v.label, "EN", G)) + "</span></div>";
    var diff = L.diffRecords(st.lastSent, st.record);
    if (diff.length) {
      html += "<div class=\"banner banner-info\" data-testid=\"diff-banner\">" + ic("alert") + "<div><strong>Changed since the last sent message</strong><ul>" +
        diff.map(function (d) { return "<li>" + esc(changeText(d)) + "</li>"; }).join("") + "</ul></div></div>";
    }
    if (v.outdated) {
      html += "<div class=\"banner banner-warn\" data-testid=\"outdated-banner\">" + ic("alert") + "<div>The record changed to v" + st.record.version +
        " while you were reviewing. Drafts are outdated and sending is disabled. " +
        "<button class=\"btn sm\" data-action=\"regenerate\">Regenerate drafts</button></div></div>";
    }
    html += recipientSummary(st, v);
    if (st.phase !== "ready") {
      var sk = "<div class=\"skeleton-card\" aria-hidden=\"true\"><span class=\"sk sk-title\"></span><span class=\"sk sk-line\"></span><span class=\"sk sk-line short\"></span></div>";
      return html + "<p class=\"gen-status\" role=\"status\"><span class=\"spinner\"></span>" + (st.phase === "writing" ? "Writing drafts…" : "Checking…") + "</p>" +
        "<div class=\"skeletons\">" + sk + sk + sk + "</div>";
    }
    html += "<div class=\"strip\"><span class=\"strip-text\"><span class=\"ok\">" + ic("check-circle") + v.ready + " ready</span><span class=\"" + (v.needs.length ? "bad" : "muted") + "\">" + ic("x-circle") +
      v.needs.length + " needs you</span></span>" +
      "<button class=\"btn sm\" data-action=\"next-issue\"" + (v.needs.length ? "" : " disabled") + ">Next issue (" + v.needs.length + ")</button>" +
      miniGrid(v) + "</div>";
    return html + v.roles.map(function (r) { return card(st, r, h); }).join("");
  };

  views.nextUpdate = function (st) {
    if (st.step !== "messages" || st.view !== "incidents" || st.record.resolved) return "";
    return "<label class=\"nu\">Next update by <input type=\"time\" data-nu value=\"" + attr(st.nextUpdate) + "\"></label>";
  };

  views.primary = function (st, v) {
    if (st.step !== "messages") return "";
    var p = v.primary;
    return "<button class=\"btn primary\" data-action=\"" + p.action + "\"" + (p.disabled ? " disabled" : "") + ">" + esc(p.label) + "</button>";
  };

  views.placeholder = function (e) {
    return "<div class=\"inc-title\"><div class=\"inc-line\"><h1>" + esc(e.title) + "</h1>" + sevPill(false) + "</div><p class=\"inc-meta\">" + e.id + "</p></div>" +
      "<div class=\"banner banner-info\">" + ic("check-circle") + "<div>" + esc(e.note) + "</div></div>";
  };

  // ---------- stakeholders ----------
  function shForm(st, c) {
    var f = st.shForm || c || { name: "", role: "ATCO_SUPERVISOR", lang: "EN", active: true };
    var roles = L.ROLE_ORDER.map(function (r) { return "<option value=\"" + r + "\"" + (f.role === r ? " selected" : "") + ">" + L.roleName(r) + "</option>"; }).join("");
    var langs = L.LANG_ORDER.map(function (l) { return "<option value=\"" + l + "\"" + (f.lang === l ? " selected" : "") + ">" + l + "</option>"; }).join("");
    return "<tr class=\"form-row\"><td colspan=\"5\"><div class=\"sh-form\">" +
      "<label>Name<input type=\"text\" data-sh-name value=\"" + attr(f.name) + "\" placeholder=\"Full name\"></label>" +
      "<label>Role<select data-sh-role>" + roles + "</select></label>" +
      "<label>Language<select data-sh-lang>" + langs + "</select></label>" +
      "<label class=\"check\"><input type=\"checkbox\" data-sh-active" + (f.active ? " checked" : "") + "> Active</label>" +
      "<span class=\"actions\"><button class=\"btn primary sm\" data-action=\"sh-save\">Save</button><button class=\"btn ghost sm\" data-action=\"sh-cancel\">Cancel</button></span>" +
      (st.shError ? "<p class=\"bad\" role=\"alert\">" + esc(st.shError) + "</p>" : "") + "</div></td></tr>";
  }

  views.stakeholders = function (st) {
    var rows = "";
    if (st.editingContact === "new") rows += shForm(st, null);
    st.contacts.forEach(function (c) {
      if (st.editingContact === c.id) { rows += shForm(st, c); return; }
      rows += "<tr class=\"" + (c.active ? "" : "inactive") + "\"><td><span class=\"person-cell\"><span class=\"avatar sm\">" + esc(initials(c.name)) + "</span>" + esc(c.name) + "</span></td>" +
        "<td>" + L.roleName(c.role) + "</td><td><span class=\"lang\">" + c.lang + "</span></td>" +
        "<td><label class=\"switch\"><input type=\"checkbox\" role=\"switch\" data-action=\"sh-toggle-active\" data-id=\"" + c.id + "\"" + (c.active ? " checked" : "") + " aria-label=\"Active\"><span class=\"track\"></span><span class=\"switch-text\">" + (c.active ? "Active" : "Inactive") + "</span></label></td>" +
        "<td class=\"t-actions\"><button class=\"btn sm ghost\" data-action=\"sh-edit\" data-id=\"" + c.id + "\" aria-label=\"Edit " + attr(c.name) + "\">" + ic("edit") + "Edit</button>" +
        "<button class=\"btn sm ghost danger\" data-action=\"sh-remove\" data-id=\"" + c.id + "\" aria-label=\"Remove " + attr(c.name) + "\">" + ic("trash") + "Remove</button></td></tr>";
    });
    return "<div class=\"inc-title\"><div class=\"inc-line\"><h1>Stakeholders</h1></div><p class=\"inc-meta\">" + st.contacts.length + " contacts · " + st.contacts.filter(function (c) { return c.active; }).length + " active</p></div>" +
      "<div class=\"sec-head\"><h2>Contact list</h2><button class=\"btn primary sm\" data-action=\"sh-add\"" + (st.editingContact === "new" ? " disabled" : "") + ">" + ic("plus") + "Add stakeholder</button></div>" +
      "<table class=\"table\"><thead><tr><th>Name</th><th>Role</th><th>Language</th><th>Status</th><th></th></tr></thead><tbody>" + rows + "</tbody></table>";
  };

  // ---------- demo + dialog ----------
  views.demo = function (st) {
    var last = st.versionIdx >= D.records.length - 1, le = lastEntry(st);
    var pending = le && confirmedCount(le) < le.messages.length;
    return "<div class=\"demo-box\"><div class=\"demo-head\"><strong>Demo controls</strong><span>INC00123 · record v" + st.record.version + "/" + D.records.length + "</span></div>" +
      "<button class=\"btn sm\" data-action=\"simulate\"" + (last ? " disabled" : "") + ">Simulate record update</button>" +
      "<button class=\"btn sm\" data-action=\"simulate-confirm\"" + (pending ? "" : " disabled") + ">Simulate confirmations</button></div>";
  };

  views.dialog = function (st, v) {
    if (!st.dialog) return "";
    var it = v.items[st.dialog.key];
    return "<div class=\"modal-backdrop\"><div class=\"modal\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Override checks\">" +
      "<h3>Override checks</h3><p class=\"muted\">" + (it ? L.roleName(it.role) + " · " + it.lang : "") + "</p>" +
      (it ? "<ul class=\"issues\">" + it.failing.map(function (c) { return "<li>" + ic("x-circle") + "<span>" + esc(c.id) + ": " + esc(c.message) + "</span></li>"; }).join("") + "</ul>" : "") +
      "<label class=\"field\">Reason (at least 10 characters)<textarea data-reason rows=\"3\">" + esc(st.dialog.text || "") + "</textarea></label>" +
      (st.dialog.error ? "<p class=\"bad\" role=\"alert\">" + esc(st.dialog.error) + "</p>" : "") +
      "<div class=\"actions\"><button class=\"btn primary\" data-action=\"override-confirm\">Confirm override</button>" +
      "<button class=\"btn ghost\" data-action=\"override-cancel\">Cancel</button></div></div></div>";
  };

  SkyNet.ui.views = views;
})();
