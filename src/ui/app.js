window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
// App state + actions. createApp(root, opts) mounts an independent instance (used by index.html and the tests).
(function () {
  var D = SkyNet.data, L = SkyNet.lib, G = D.glossary, V = SkyNet.ui.views;
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var fmtTime = function (d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  // The one inbox entry driven by records.js; the others are static placeholders.
  var LIVE_ID = D.inbox.filter(function (e) { return e.live; })[0].id;

  SkyNet.createApp = function (root, opts) {
    opts = opts || {};
    var clock = opts.clock || { setTimeout: function (fn, ms) { return window.setTimeout(fn, ms); } };
    var now = opts.now || function () { return new Date(); };

    var st = {
      versionIdx: 0, record: D.records[0],
      view: "incidents", selected: LIVE_ID, unread: true, step: "incident",
      opLang: "EN",
      contacts: D.contacts.map(function (c) { return { id: c.id, name: c.name, role: c.role, lang: c.lang, active: c.active }; }),
      editingContact: null, shForm: null, shError: "",
      history: [], lastSent: null, sentVersion: null,
      overrides: { added: [], removed: [] },
      drafts: {}, approved: {}, expandedOnce: {}, expandedRoles: {}, expandedLang: {},
      editing: null, dialog: null, historyOpen: {}, recipientsOpen: false,
      phase: "ready", outdated: false, gen: 0, nextUpdate: "", destroyed: false
    };

    // ---------- derived view ----------
    // Review version = operator language, falling back to EN when the content pack has no draft in it.
    function reviewLangFor(role) {
      var has = D.drafts.some(function (d) { return d.recordVersion === st.record.version && d.role === role && d.lang === st.opLang; });
      return has ? st.opLang : "EN";
    }
    function renderDraft(draft, lang) {
      var label = L.labelText(L.getLabel(st.history.length, st.record), lang, G);
      return L.render(draft.template, lang, st.record, G, { label: label, nextUpdate: st.nextUpdate });
    }
    function currentKeys() {
      var recipients = L.getRecipients(st.record, st.contacts, D.roleRules, st.overrides);
      return { recipients: recipients, keys: L.getDraftKeys(recipients, reviewLangFor) };
    }

    function approvalSig(role, keys) {
      return keys.filter(function (k) { return k.role === role; }).map(function (k) { return k.key; }).join(",");
    }

    function derive() {
      var record = st.record, rk = currentKeys(), recipients = rk.recipients, keys = rk.keys;
      var reviewKey = {};
      keys.forEach(function (k) { if (k.review) reviewKey[k.role] = k.key; });
      var items = {};
      keys.forEach(function (k) {
        var d = st.drafts[k.key], checks;
        if (!d || d.template == null) {
          checks = [{ id: "draft_exists", pass: false, message: "No draft available for " + L.roleName(k.role) + " in " + k.lang }];
        } else {
          var rev = st.drafts[reviewKey[k.role]];
          checks = L.runChecks(d, rev && rev.template != null ? rev : d, record, G, k.role);
        }
        var failing = checks.filter(function (c) { return !c.pass; });
        items[k.key] = { role: k.role, lang: k.lang, key: k.key, review: k.review, reviewOnly: k.reviewOnly, draft: d, checks: checks,
          failing: failing, overridden: !!(d && d.override), needs: failing.length > 0 && !(d && d.override) };
      });
      var roles = L.ROLE_ORDER.filter(function (r) { return keys.some(function (k) { return k.role === r; }); }).map(function (role) {
        // An approval only covers the languages that existed when it was given.
        return { role: role, keys: keys.filter(function (k) { return k.role === role; }).map(function (k) { return items[k.key]; }),
          approved: st.approved[role] === approvalSig(role, keys) };
      });
      var needs = keys.filter(function (k) { return items[k.key].needs; }).map(function (k) { return items[k.key]; });
      var firstUnapproved = roles.filter(function (r) { return !r.approved; })[0];
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
      "<div class=\"app\"><nav id=\"r-rail\" class=\"rail\"></nav><aside id=\"r-inbox\" class=\"inbox\"></aside>" +
      "<main class=\"main\"><header id=\"r-head\" class=\"inc-head\"></header><div id=\"r-body\" class=\"body\"></div>" +
      "<div id=\"r-footer\" class=\"footer-bar\"><span id=\"r-nu\"></span><span id=\"r-primary\"></span></div></main>" +
      "<div id=\"r-dialog\"></div></div>";

    var helpers = { renderDraft: renderDraft };
    function liveSelected() { return st.selected === LIVE_ID; }
    function bodyHtml(v) {
      if (st.view === "stakeholders") return V.stakeholders(st);
      if (!liveSelected()) return V.placeholder(D.inbox.filter(function (e) { return e.id === st.selected; })[0]);
      if (st.step === "recipients") return V.recipientsStep(st, v);
      if (st.step === "messages") return V.messages(st, v, helpers);
      return V.incidentStep(st, v);
    }
    function renderBody(v) {
      $("#r-body").innerHTML = bodyHtml(v);
      $("#r-primary").innerHTML = V.primary(st, v);
    }
    function render() {
      if (st.destroyed) return;
      var v = derive(), incidents = st.view === "incidents";
      $(".app").classList.toggle("no-list", !incidents);
      $("#r-rail").innerHTML = V.rail(st);
      $("#r-inbox").innerHTML = incidents ? V.inbox(st) : "";
      $("#r-head").innerHTML = incidents && liveSelected() ? V.head(st, v) : "";
      renderBody(v);
      $("#r-nu").innerHTML = V.nextUpdate(st);
      $("#r-footer").hidden = !(incidents && liveSelected() && st.step === "messages");
      $("#r-dialog").innerHTML = V.dialog(st, v);
    }

    // ---------- state helpers ----------
    function makeDraft(role, lang) {
      var found = D.drafts.filter(function (d) { return d.recordVersion === st.record.version && d.role === role && d.lang === lang; })[0];
      return { role: role, lang: lang, template: found ? found.template : null, recordVersion: st.record.version, edited: false, override: null };
    }
    function ensureDrafts() {
      if (st.outdated) return;
      currentKeys().keys.forEach(function (k) {
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
    function refreshDrafts() { if (st.step === "messages") ensureDrafts(); }

    function focusKey(sel) {
      var el = $(sel);
      if (el) { if (el.scrollIntoView) el.scrollIntoView({ block: "center" }); el.classList.add("flash"); }
    }
    function nextIssue() {
      var v = derive();
      if (!v.needs.length) return;
      var it = v.needs[0];
      st.view = "incidents"; st.selected = LIVE_ID; st.step = "messages";
      st.expandedRoles[it.role] = true; st.expandedOnce[it.role] = true;
      if (!it.review) st.expandedLang[it.key] = true;
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
      var overrides = [], messages = [], sentAt = fmtTime(now());
      v.keys.forEach(function (k) {
        var it = v.items[k.key];
        if (it.overridden) overrides.push({ role: k.role, lang: k.lang, reason: it.draft.override.reason, checks: it.draft.override.checks });
        v.recipients.filter(function (c) { return c.role === k.role && c.lang === k.lang; }).forEach(function (c) {
          messages.push({ recipient: c.name, role: c.role, lang: c.lang, text: renderDraft(it.draft, k.lang).text,
            status: "sent", sentAt: sentAt, deliveredAt: null, confirmedAt: null });
        });
      });
      var entry = { label: L.labelText(v.label, "EN", G), time: sentAt, version: st.record.version,
        approver: "SMC operator", overrides: overrides, messages: messages };
      st.history.push(entry);
      st.lastSent = st.record;
      st.sentVersion = st.record.version;
      st.step = "incident";
      resetInteraction();
      // Simulated channel receipt: every message reports "Delivered" shortly after sending.
      clock.setTimeout(function () {
        if (st.destroyed) return;
        entry.messages.forEach(function (m) { if (m.status === "sent") { m.status = "delivered"; m.deliveredAt = fmtTime(now()); } });
        render();
      }, 1000);
      render();
    }

    function confirm(m) {
      var t = fmtTime(now());
      if (m.status === "sent") { m.status = "delivered"; m.deliveredAt = t; }
      m.status = "confirmed"; m.confirmedAt = t;
    }

    function readContactForm() {
      return {
        name: ($("[data-sh-name]").value || "").trim(), role: $("[data-sh-role]").value,
        lang: $("[data-sh-lang]").value, active: $("[data-sh-active]").checked
      };
    }
    function nextContactId() {
      var max = 0;
      st.contacts.forEach(function (c) { var n = parseInt(c.id.slice(1), 10); if (n > max) max = n; });
      return "c" + (max + 1);
    }

    // ---------- events ----------
    var actions = {
      nav: function (el) { st.view = el.dataset.view; st.editingContact = null; st.shForm = null; st.shError = ""; },
      "set-lang": function (el) { st.opLang = el.dataset.lang; refreshDrafts(); },
      select: function (el) { st.view = "incidents"; st.selected = el.dataset.id; if (st.selected === LIVE_ID) st.unread = false; },
      inform: function () { st.unread = false; st.step = "recipients"; },
      "back-incident": function () { st.step = "incident"; },
      generate: function () { st.step = "messages"; regenerate(); },
      "toggle-card": function (el) {
        var role = el.dataset.role;
        st.expandedRoles[role] = !st.expandedRoles[role];
        if (st.expandedRoles[role]) st.expandedOnce[role] = true;
      },
      "toggle-lang": function (el) { st.expandedLang[el.dataset.key] = !st.expandedLang[el.dataset.key]; },
      approve: function (el) {
        var role = el.dataset.role;
        if (st.expandedOnce[role]) st.approved[role] = approvalSig(role, currentKeys().keys);
      },
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
        refreshDrafts();
      },
      "sh-add": function () { st.editingContact = "new"; st.shForm = null; st.shError = ""; },
      "sh-edit": function (el) { st.editingContact = el.dataset.id; st.shForm = null; st.shError = ""; },
      "sh-cancel": function () { st.editingContact = null; st.shForm = null; st.shError = ""; },
      "sh-save": function () {
        var f = readContactForm();
        if (!f.name) { st.shForm = f; st.shError = "Name is required."; return; }
        if (st.editingContact === "new") st.contacts.push({ id: nextContactId(), name: f.name, role: f.role, lang: f.lang, active: f.active });
        else {
          var c = st.contacts.filter(function (x) { return x.id === st.editingContact; })[0];
          if (c) { c.name = f.name; c.role = f.role; c.lang = f.lang; c.active = f.active; }
        }
        st.editingContact = null; st.shForm = null; st.shError = "";
        refreshDrafts();
      },
      "sh-toggle-active": function (el) {
        var c = st.contacts.filter(function (x) { return x.id === el.dataset.id; })[0];
        if (c) c.active = !c.active;
        refreshDrafts();
      },
      "sh-remove": function (el) {
        var id = el.dataset.id;
        st.contacts = st.contacts.filter(function (c) { return c.id !== id; });
        st.overrides.added = st.overrides.added.filter(function (x) { return x !== id; });
        st.overrides.removed = st.overrides.removed.filter(function (x) { return x !== id; });
        refreshDrafts();
      },
      "confirm-msg": function (el) {
        var e = st.history[el.dataset.h], m = e && e.messages[el.dataset.m];
        if (m) confirm(m);
      },
      "simulate-confirm": function () {
        var e = st.history[st.history.length - 1];
        if (e) e.messages.forEach(function (m) { if (m.status !== "confirmed") confirm(m); });
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

    // ---------- focus ----------
    // Every render replaces the DOM, so focus is restored to the equivalent element afterwards.
    var FOCUS_ATTRS = ["action", "role", "key", "id", "lang", "view", "idx", "h", "m"];
    function selectorFor(el) {
      if (!el || !root.contains(el) || !el.dataset || !el.dataset.action) return null;
      return FOCUS_ATTRS.filter(function (a) { return el.dataset[a] != null; })
        .map(function (a) { return "[data-" + a + "=" + JSON.stringify(el.dataset[a]) + "]"; }).join("");
    }
    function focusFirst(selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = selectors[i] && $(selectors[i]);
        if (el && !el.disabled) { el.focus({ preventScroll: true }); return; }
      }
    }
    function closeDialog() {
      var d = st.dialog;
      st.dialog = null;
      render();
      if (d) focusFirst([d.returnTo, "[data-action=\"edit\"][data-key=" + JSON.stringify(d.key) + "]"]);
    }

    function onClick(e) {
      var el = e.target.closest ? e.target.closest("[data-action]") : null;
      if (!el || !root.contains(el) || el.disabled) return;
      var name = el.dataset.action, fn = actions[name];
      if (!fn) return;
      var hadDialog = !!st.dialog, focusSel = document.activeElement === el ? selectorFor(el) : null;
      fn(el);
      if (selfRendering[name]) return;
      if (hadDialog && !st.dialog) { closeDialog(); return; }
      render();
      if (st.dialog && !hadDialog) { st.dialog.returnTo = focusSel; focusFirst(["[data-reason]"]); }
      else if (st.dialog && st.dialog.error) focusFirst(["[data-reason]"]);
      else if (st.editing && name === "edit") focusFirst(["[data-edit-area]"]);
      else if (focusSel && name === "approve") {
        // The Approve button is now disabled: move on to the next role to approve, else the primary button.
        var next = derive().firstUnapproved;
        focusFirst([next ? "[data-action=\"toggle-card\"][data-role=\"" + next.role + "\"]" : null, "#r-primary button"]);
      } else if (focusSel) {
        focusFirst([focusSel, el.dataset.role ? "[data-action=\"toggle-card\"][data-role=" + JSON.stringify(el.dataset.role) + "]" : null]);
      }
    }
    function onInput(e) {
      if (!e.target.matches || !e.target.matches("[data-nu]")) return;
      st.nextUpdate = e.target.value;
      renderBody(derive()); // keep the time input itself untouched while typing
    }
    function onKey(e) {
      if (st.dialog) {
        if (e.key === "Escape") { e.preventDefault(); closeDialog(); return; }
        if (e.key === "Tab") trapTab(e);
        return; // no shortcuts while the dialog is open
      }
      if (e.ctrlKey || e.metaKey || e.altKey || (e.key !== "n" && e.key !== "N")) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if (st.step === "messages" && st.view === "incidents" && liveSelected()) nextIssue();
    }
    function trapTab(e) {
      var modal = $(".modal");
      if (!modal) return;
      var items = modal.querySelectorAll("button:not([disabled]), textarea, input, select");
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1], inside = modal.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
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
        st.destroyed = true;
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
