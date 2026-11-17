window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
// App state + actions. createApp(root, opts) mounts an independent instance (used by index.html and the tests).
(function () {
  var D = SkyNet.data, L = SkyNet.lib, G = D.glossary, V = SkyNet.ui.views;
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var fmtTime = function (d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); };

  SkyNet.createApp = function (root, opts) {
    opts = opts || {};
    var clock = opts.clock || { setTimeout: function (fn, ms) { return window.setTimeout(fn, ms); } };
    var now = opts.now || function () { return new Date(); };

    var st = {
      versionIdx: 0, record: D.records[0],
      selected: "INC00123", unread: true, step: "incident",
      history: [], lastSent: null, sentVersion: null,
      overrides: { added: [], removed: [] },
      drafts: {}, approved: {}, expandedOnce: {}, expandedRoles: {}, expandedLang: {},
      editing: null, dialog: null, historyOpen: {}, recipientsOpen: false,
      phase: "ready", outdated: false, gen: 0, nextUpdate: ""
    };

    // ---------- derived view ----------
    function renderDraft(draft, lang) {
      var label = L.labelText(L.getLabel(st.history.length, st.record), lang, G);
      return L.render(draft.template, lang, st.record, G, { label: label, nextUpdate: st.nextUpdate });
    }

    function derive() {
      var record = st.record;
      var recipients = L.getRecipients(record, D.contacts, D.roleRules, st.overrides);
      var keys = L.getDraftKeys(recipients);
      var items = {};
      keys.forEach(function (k) {
        var d = st.drafts[k.key], checks;
        if (!d || d.template == null) {
          checks = [{ id: "draft_exists", pass: false, message: "No draft available for " + L.roleName(k.role) + " in " + k.lang }];
        } else {
          var en = st.drafts[k.role + ":EN"];
          checks = L.runChecks(d, en && en.template != null ? en : d, record, G, k.role);
        }
        var failing = checks.filter(function (c) { return !c.pass; });
        items[k.key] = { role: k.role, lang: k.lang, key: k.key, reviewOnly: k.reviewOnly, draft: d, checks: checks,
          failing: failing, overridden: !!(d && d.override), needs: failing.length > 0 && !(d && d.override) };
      });
      var roles = L.ROLE_ORDER.filter(function (r) { return keys.some(function (k) { return k.role === r; }); }).map(function (role) {
        return { role: role, keys: keys.filter(function (k) { return k.role === role; }).map(function (k) { return items[k.key]; }) };
      });
      var needs = keys.filter(function (k) { return items[k.key].needs; }).map(function (k) { return items[k.key]; });
      var firstUnapproved = roles.filter(function (r) { return !st.approved[r.role]; })[0];
      var outdated = st.outdated || keys.some(function (k) { var d = items[k.key].draft; return d && d.recordVersion !== record.version; });
      var sentThis = st.sentVersion === record.version;
      var nuOk = record.resolved || /^\d{2}:\d{2}$/.test(st.nextUpdate);
      var canSend = st.step === "messages" && st.phase === "ready" && !sentThis && !outdated && needs.length === 0 && !firstUnapproved && nuOk && keys.length > 0;

      var primary;
      if (st.phase !== "ready") primary = { label: "Generating…", action: "none", disabled: true };
      else if (outdated) primary = { label: "Regenerate drafts", action: "regenerate", disabled: false };
      else if (needs.length) primary = { label: "Fix " + needs.length + " issue" + (needs.length === 1 ? "" : "s"), action: "next-issue", disabled: false };
      else if (firstUnapproved) primary = { label: "Approve remaining roles", action: "next-unapproved", disabled: false };
      else primary = { label: "Send to outbox", action: "send", disabled: !canSend };

      return { recipients: recipients, keys: keys, items: items, roles: roles, needs: needs, ready: keys.length - needs.length,
        firstUnapproved: firstUnapproved, outdated: outdated, sentThis: sentThis, canSend: canSend, primary: primary,
        label: L.getLabel(st.history.length, record) };
    }

    // ---------- rendering ----------
    var $ = function (sel) { return root.querySelector(sel); };
    root.innerHTML =
      "<div class=\"app\"><aside id=\"r-inbox\" class=\"inbox\"></aside>" +
      "<main class=\"main\"><header id=\"r-head\" class=\"inc-head\"></header><div id=\"r-body\" class=\"body\"></div>" +
      "<div id=\"r-footer\" class=\"footer-bar\"><span id=\"r-nu\"></span><span id=\"r-primary\"></span></div></main>" +
      "<div id=\"r-demo\"></div><div id=\"r-dialog\"></div></div>";

    var helpers = { renderDraft: renderDraft };
    function liveSelected() { return st.selected === "INC00123"; }
    function bodyHtml(v) {
      if (!liveSelected()) {
        return V.placeholder(D.inbox.filter(function (e) { return e.id === st.selected; })[0]);
      }
      if (st.step === "recipients") return V.recipientsStep(st, v);
      if (st.step === "messages") return V.messages(st, v, helpers);
      return V.incidentStep(st, v);
    }
    function renderBody(v) {
      $("#r-body").innerHTML = bodyHtml(v);
      $("#r-primary").innerHTML = V.primary(st, v);
    }
    function render() {
      var v = derive();
      $("#r-inbox").innerHTML = V.inbox(st);
      $("#r-head").innerHTML = liveSelected() ? V.head(st, v) : "";
      renderBody(v);
      $("#r-nu").innerHTML = V.nextUpdate(st);
      $("#r-footer").hidden = !(liveSelected() && st.step === "messages");
      $("#r-demo").innerHTML = V.demo(st);
      $("#r-dialog").innerHTML = V.dialog(st, v);
    }

    // ---------- state helpers ----------
    function makeDraft(role, lang) {
      var found = D.drafts.filter(function (d) { return d.recordVersion === st.record.version && d.role === role && d.lang === lang; })[0];
      return { role: role, lang: lang, template: found ? found.template : null, recordVersion: st.record.version, edited: false, override: null };
    }
    function ensureDrafts() {
      if (st.outdated) return;
      L.getDraftKeys(L.getRecipients(st.record, D.contacts, D.roleRules, st.overrides)).forEach(function (k) {
        if (!st.drafts[k.key]) st.drafts[k.key] = makeDraft(k.role, k.lang);
      });
    }
    function defaultNextUpdate() { return fmtTime(new Date(now().getTime() + 30 * 60000)); }
    function resetInteraction() {
      st.drafts = {}; st.approved = {}; st.expandedOnce = {}; st.expandedRoles = {}; st.expandedLang = {};
      st.editing = null; st.dialog = null;
    }
    function pristine() {
      var any = function (o) { return Object.keys(o).some(function (k) { return o[k]; }); };
      var touched = Object.keys(st.drafts).some(function (k) { return st.drafts[k].edited || st.drafts[k].override; });
      return !any(st.approved) && !any(st.expandedOnce) && !touched;
    }
    function regenerate() {
      resetInteraction();
      st.outdated = false;
      if (!st.record.resolved) st.nextUpdate = defaultNextUpdate();
      ensureDrafts();
      var gen = ++st.gen;
      st.phase = "writing";
      render();
      clock.setTimeout(function () {
        if (gen !== st.gen) return;
        st.phase = "checking"; render();
        clock.setTimeout(function () {
          if (gen !== st.gen) return;
          st.phase = "ready"; render();
        }, 1000);
      }, 1000);
    }
    function unapprove(role) { st.approved[role] = false; }

    function focusKey(sel) {
      var el = $(sel);
      if (el) { if (el.scrollIntoView) el.scrollIntoView({ block: "center" }); el.classList.add("flash"); }
    }
    function nextIssue() {
      var v = derive();
      if (!v.needs.length) return;
      var it = v.needs[0];
      st.expandedRoles[it.role] = true; st.expandedOnce[it.role] = true;
      if (it.lang !== "EN") st.expandedLang[it.key] = true;
      render();
      focusKey(".draft[data-key=\"" + it.key + "\"]");
    }
    function nextUnapproved() {
      var v = derive();
      if (!v.firstUnapproved) return;
      var role = v.firstUnapproved.role;
      st.expandedRoles[role] = true; st.expandedOnce[role] = true;
      render();
      focusKey(".card[data-role=\"" + role + "\"]");
    }

    function simulate() {
      if (st.versionIdx >= D.records.length - 1) return;
      st.versionIdx++;
      st.record = D.records[st.versionIdx];
      st.unread = true;
      if (st.step === "messages") {
        if (pristine()) { regenerate(); return; }
        st.outdated = true;
      }
      render();
    }

    function send() {
      var v = derive();
      if (!v.canSend) return;
      var overrides = [], messages = [];
      v.keys.forEach(function (k) {
        var it = v.items[k.key];
        if (it.overridden) overrides.push({ role: k.role, lang: k.lang, reason: it.draft.override.reason, checks: it.draft.override.checks });
        v.recipients.filter(function (c) { return c.role === k.role && c.lang === k.lang; }).forEach(function (c) {
          messages.push({ recipient: c.name, role: c.role, lang: c.lang, text: renderDraft(it.draft, k.lang).text });
        });
      });
      st.history.push({ label: L.labelText(v.label, "EN", G), time: fmtTime(now()), version: st.record.version,
        approver: "SMC operator", overrides: overrides, messages: messages });
      st.lastSent = st.record;
      st.sentVersion = st.record.version;
      st.step = "incident";
      resetInteraction();
      render();
    }

    // ---------- events ----------
    var actions = {
      select: function (el) { st.selected = el.dataset.id; if (st.selected === "INC00123") st.unread = false; },
      inform: function () { st.step = "recipients"; },
      "back-incident": function () { st.step = "incident"; },
      generate: function () { st.step = "messages"; regenerate(); },
      "toggle-card": function (el) {
        var role = el.dataset.role;
        st.expandedRoles[role] = !st.expandedRoles[role];
        if (st.expandedRoles[role]) st.expandedOnce[role] = true;
      },
      "toggle-lang": function (el) { st.expandedLang[el.dataset.key] = !st.expandedLang[el.dataset.key]; },
      approve: function (el) { if (st.expandedOnce[el.dataset.role]) st.approved[el.dataset.role] = true; },
      fix: function (el) {
        var it = derive().items[el.dataset.key];
        var fix = it && it.failing.filter(function (c) { return c.fix; })[0];
        if (!fix) return;
        it.draft.template = fix.fix; it.draft.edited = true; it.draft.override = null; unapprove(it.role);
      },
      edit: function (el) { st.editing = el.dataset.key; },
      "edit-cancel": function () { st.editing = null; },
      "edit-save": function (el) {
        var d = st.drafts[el.dataset.key], ta = $("[data-edit-area]");
        if (d && ta) { d.template = ta.value; d.edited = true; d.override = null; unapprove(d.role); }
        st.editing = null;
      },
      override: function (el) { st.dialog = { key: el.dataset.key, text: "", error: "" }; },
      "override-cancel": function () { st.dialog = null; },
      "override-confirm": function () {
        var ta = $("[data-reason]"), text = ta ? ta.value : "";
        var reason = text.trim();
        if (reason.length < 10) { st.dialog.text = text; st.dialog.error = "Reason must be at least 10 characters."; return; }
        var it = derive().items[st.dialog.key];
        if (it && it.draft) {
          it.draft.override = { reason: reason, checks: it.failing.map(function (c) { return c.id; }) };
          unapprove(it.role);
        }
        st.dialog = null;
      },
      "toggle-recipients": function () { st.recipientsOpen = !st.recipientsOpen; },
      "toggle-recipient": function (el) {
        var id = el.dataset.id, o = st.overrides;
        var present = derive().recipients.some(function (c) { return c.id === id; });
        if (present) {
          if (o.added.indexOf(id) >= 0) o.added = o.added.filter(function (x) { return x !== id; });
          else if (o.removed.indexOf(id) < 0) o.removed = o.removed.concat(id);
        } else if (o.removed.indexOf(id) >= 0) o.removed = o.removed.filter(function (x) { return x !== id; });
        else o.added = o.added.concat(id);
        if (st.step === "messages") ensureDrafts();
      },
      "toggle-history": function (el) { st.historyOpen[el.dataset.idx] = !st.historyOpen[el.dataset.idx]; },
      "next-issue": nextIssue,
      "next-unapproved": nextUnapproved,
      regenerate: regenerate,
      send: send,
      simulate: simulate,
      none: function () {}
    };
    var selfRendering = { "next-issue": 1, "next-unapproved": 1, regenerate: 1, simulate: 1, send: 1, generate: 1 };

    function onClick(e) {
      var el = e.target.closest ? e.target.closest("[data-action]") : null;
      if (!el || !root.contains(el) || el.disabled) return;
      var name = el.dataset.action, fn = actions[name];
      if (!fn) return;
      fn(el);
      if (!selfRendering[name]) render();
    }
    function onInput(e) {
      if (!e.target.matches || !e.target.matches("[data-nu]")) return;
      st.nextUpdate = e.target.value;
      renderBody(derive()); // keep the time input itself untouched while typing
    }
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.key !== "n" && e.key !== "N")) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if (st.step === "messages" && liveSelected()) nextIssue();
    }
    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onInput);
    document.addEventListener("keydown", onKey);

    render();

    return {
      state: st,
      derive: derive,
      regenerate: regenerate,
      destroy: function () {
        root.removeEventListener("click", onClick);
        root.removeEventListener("input", onInput);
        root.removeEventListener("change", onInput);
        document.removeEventListener("keydown", onKey);
        st.gen++;
        root.innerHTML = "";
      }
    };
  };
})();
