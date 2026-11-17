describe("App", function () {
  // mount(false) opens the incident view; mount() also walks inform -> recipients -> generate.
  function mount(stayOnIncident) {
    var queue = [];
    var clock = { setTimeout: function (fn) { queue.push(fn); } };
    var root = document.createElement("div");
    document.getElementById("test-root").appendChild(root);
    var app = SkyNet.createApp(root, { clock: clock, now: function () { return new Date(2026, 10, 20, 13, 5); } });
    var t = {
      root: root, app: app,
      flush: function () { while (queue.length) queue.shift()(); },
      btn: function (text, within) {
        var all = (within || root).querySelectorAll("button");
        for (var i = 0; i < all.length; i++) if (all[i].textContent.indexOf(text) >= 0) return all[i];
        return null;
      },
      act: function (name) {
        var b = root.querySelector("[data-action=\"" + name + "\"]");
        if (!b) throw new Error("action not found: " + name);
        if (b.disabled) throw new Error("action disabled: " + name);
        b.click();
      },
      click: function (text, within) {
        var b = t.btn(text, within);
        if (!b) throw new Error("button not found: " + text);
        if (b.disabled) throw new Error("button disabled: " + text);
        b.click();
      },
      round: function () { t.act("inform"); t.act("generate"); t.flush(); },
      card: function (role) { return root.querySelector(".card[data-role=\"" + role + "\"]"); },
      approve: function (role) { t.click("Approve", t.card(role)); },
      expand: function (role) { t.click(SkyNet.lib.roleName(role), t.card(role)); },
      expandAndApproveAll: function () {
        Array.prototype.map.call(root.querySelectorAll(".card"), function (c) { return c.getAttribute("data-role"); }).forEach(function (role) {
          t.expand(role);
          t.approve(role);
        });
      },
      history: function () {
        return Array.prototype.map.call(root.querySelectorAll(".history-entry h3"), function (h) { return h.textContent; }).reverse();
      },
      destroy: function () { app.destroy(); root.remove(); }
    };
    if (!stayOnIncident) t.round();
    return t;
  }

  function sendV1(t) {
    t.expandAndApproveAll();
    t.click("Send to outbox");
  }

  it("inbox lists incoming incidents; the live one is new until opened", function () {
    var t = mount(true);
    var items = t.root.querySelectorAll(".inbox-item");
    expect(items).toHaveLength(3);
    expect(t.root.querySelector(".inbox-item.selected").textContent).toContain("Primary radar failure");
    expect(t.root.querySelector(".inbox-item.selected .badge").textContent).toBe("New");
    t.root.querySelector(".inbox-item.selected").click();
    expect(t.root.querySelector(".inbox-item.selected .badge").textContent).toContain("Action needed");
    t.destroy();
  });

  it("other inbox entries are placeholders without the stakeholder flow", function () {
    var t = mount(true);
    t.root.querySelectorAll(".inbox-item")[1].click();
    expect(t.root.querySelector("[data-action=inform]")).toBe(null);
    expect(t.root.querySelector(".body").textContent).toContain("No stakeholder action required");
    t.destroy();
  });

  it("Inform stakeholders opens a recipients step with the suggested people", function () {
    var t = mount(true);
    expect(t.btn("Inform stakeholders")).toBeTruthy();
    t.act("inform");
    var body = t.root.querySelector(".body").textContent;
    expect(body).toContain("Who will be informed");
    expect(body).toContain("Anna Müller");
    expect(body).toContain("Not notified for non-major incidents");
    expect(body).toContain("5 people will be contacted");
    expect(t.root.querySelector("input[data-id=\"c8\"]").disabled).toBe(true);
    t.destroy();
  });

  it("recipients can be removed and added before generating", function () {
    var t = mount(true);
    t.act("inform");
    t.root.querySelector("input[data-id=\"c3\"]").click();
    expect(t.root.querySelector(".body").textContent).toContain("4 people will be contacted");
    expect(t.root.querySelector(".body").textContent).toContain("removed by you");
    t.root.querySelector("input[data-id=\"c7\"]").click();
    expect(t.root.querySelector(".body").textContent).toContain("5 people will be contacted");
    expect(t.root.querySelector(".body").textContent).toContain("added by you");
    t.act("generate");
    t.flush();
    var v = t.app.derive();
    expect(v.recipients.map(function (c) { return c.id; })).not.toContain("c3");
    expect(v.recipients.map(function (c) { return c.id; })).toContain("c7");
    expect(v.keys.map(function (k) { return k.key; })).toContain("MANAGEMENT:EN");
    t.destroy();
  });

  it("Approve is disabled until the card has been expanded", function () {
    var t = mount();
    expect(t.btn("Approve", t.card("ATCO_SUPERVISOR")).disabled).toBe(true);
    t.expand("ATCO_SUPERVISOR");
    expect(t.btn("Approve", t.card("ATCO_SUPERVISOR")).disabled).toBe(false);
    t.destroy();
  });

  it("v1 generates 6 drafts, all ready, for 5 recipients", function () {
    var t = mount();
    var v = t.app.derive();
    expect(v.recipients).toHaveLength(5);
    expect(v.keys).toHaveLength(6);
    expect(v.needs).toHaveLength(0);
    expect(t.root.querySelector(".strip-text").textContent).toContain("6 ready");
    t.destroy();
  });

  it("shows the generating status before drafts are ready", function () {
    var t = mount(true);
    t.act("inform");
    t.act("generate");
    expect(t.root.querySelector(".gen-status").textContent).toContain("Writing drafts");
    t.flush();
    expect(t.root.querySelector(".gen-status")).toBe(null);
    t.destroy();
  });

  it("Send is blocked while a check fails; override needs a reason of 10+ characters", function () {
    var t = mount();
    sendV1(t);
    t.click("Simulate record update");
    t.round();
    expect(t.root.querySelector(".strip-text").textContent).toContain("7 ready");
    expect(t.root.querySelector(".strip-text").textContent).toContain("1 needs you");
    t.expandAndApproveAll();
    expect(t.btn("Send to outbox")).toBe(null);
    expect(t.btn("Fix 1 issue")).toBeTruthy();
    t.click("Next issue");
    t.click("Override…");
    t.root.querySelector("[data-reason]").value = "too short";
    t.click("Confirm override");
    expect(t.root.querySelector("[role=dialog]")).toBeTruthy();
    expect(t.btn("Fix 1 issue")).toBeTruthy();
    t.root.querySelector("[data-reason]").value = "Verified manually with ENG lead";
    t.click("Confirm override");
    expect(t.root.querySelector("[role=dialog]")).toBe(null);
    t.approve("ENGINEERING"); // overriding resets that role's approval
    expect(t.btn("Send to outbox").disabled).toBe(false);
    t.click("Send to outbox");
    var overrides = t.app.state.history[1].overrides;
    expect(overrides).toHaveLength(1);
    expect(overrides[0].reason).toBe("Verified manually with ENG lead");
    t.destroy();
  });

  it("full demo path: inform, send, update, fix FR issue, send, v3, send", function () {
    var t = mount(true);
    t.round();
    sendV1(t);
    expect(t.history()).toEqual(["Initial"]);
    expect(t.root.querySelector("[data-testid=sent-banner]").textContent).toContain("Initial");
    t.click("Simulate record update");
    expect(t.root.querySelector(".inbox-item.selected .badge").textContent).toBe("Updated");
    var banner = t.root.querySelector("[data-testid=diff-banner]").textContent;
    expect(banner).toContain("14:00 → 16:00");
    expect(banner).toContain("Datalink: OPERATIONAL → UNAVAILABLE");
    expect(banner).toContain("Major incident: no → yes");
    expect(t.btn("Send update to stakeholders")).toBeTruthy();
    t.act("inform");
    expect(t.root.querySelector(".body").textContent).toContain("Notified because this is a major incident");
    expect(t.root.querySelector(".body").textContent).toContain("7 people will be contacted");
    t.act("generate");
    t.flush();
    expect(t.root.querySelector(".recipients").textContent).toContain("Management added");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "N" }));
    expect(t.root.textContent).toContain("Données de surveillance : HORS SERVICE\" is not a record term");
    t.click("Use record term");
    expect(t.root.querySelector(".strip-text").textContent).toContain("8 ready");
    t.expandAndApproveAll();
    t.click("Send to outbox");
    expect(t.history()).toEqual(["Initial", "Update 1"]);
    t.click("Simulate record update");
    expect(t.btn("Send resolution notice")).toBeTruthy();
    t.round();
    expect(t.root.querySelector("[data-nu]")).toBe(null);
    t.expandAndApproveAll();
    t.click("Send to outbox");
    expect(t.history()).toEqual(["Initial", "Update 1", "Resolved"]);
    t.destroy();
  });

  it("an update mid-review shows the banner and disables Send; Regenerate resets approvals", function () {
    var t = mount();
    t.expand("ATCO_SUPERVISOR");
    t.approve("ATCO_SUPERVISOR");
    t.click("Simulate record update");
    expect(t.root.querySelector("[data-testid=outdated-banner]")).toBeTruthy();
    expect(t.btn("Send to outbox")).toBe(null);
    t.click("Regenerate drafts", t.root.querySelector("[data-testid=outdated-banner]"));
    t.flush();
    expect(t.root.querySelector("[data-testid=outdated-banner]")).toBe(null);
    expect(t.btn("Approve", t.card("ATCO_SUPERVISOR")).disabled).toBe(true);
    expect(t.app.state.approved.ATCO_SUPERVISOR).toBeFalsy();
    expect(t.app.derive().keys).toHaveLength(8);
    t.destroy();
  });

  it("an untouched draft set regenerates automatically on update", function () {
    var t = mount();
    t.click("Simulate record update");
    expect(t.root.querySelector("[data-testid=outdated-banner]")).toBe(null);
    expect(t.root.querySelector(".gen-status")).toBeTruthy();
    t.flush();
    expect(t.app.derive().keys).toHaveLength(8);
    t.destroy();
  });

  it("Regenerate also resets overrides", function () {
    var t = mount();
    sendV1(t);
    t.click("Simulate record update");
    t.round();
    t.click("Next issue");
    t.click("Override…");
    t.root.querySelector("[data-reason]").value = "Accepting for the demo";
    t.click("Confirm override");
    t.click("Simulate record update");
    expect(t.root.querySelector("[data-testid=outdated-banner]")).toBeTruthy();
    t.click("Regenerate drafts", t.root.querySelector("[data-testid=outdated-banner]"));
    t.flush();
    expect(t.app.derive().needs.length).toBe(0); // v3 drafts are all clean
    expect(Object.keys(t.app.state.drafts).every(function (k) { return !t.app.state.drafts[k].override; })).toBe(true);
    t.destroy();
  });

  it("the history entry has no message for an EN review-only draft", function () {
    var t = mount();
    sendV1(t);
    var msgs = t.app.state.history[0].messages;
    expect(msgs).toHaveLength(5);
    expect(msgs.filter(function (m) { return m.role === "ENGINEERING" && m.lang === "EN"; })).toHaveLength(0);
    expect(msgs.filter(function (m) { return m.role === "ENGINEERING"; }).map(function (m) { return m.lang; })).toEqual(["DE", "FR"]);
    t.destroy();
  });

  it("each message is rendered in the recipient's language", function () {
    var t = mount();
    sendV1(t);
    var claire = t.app.state.history[0].messages.filter(function (m) { return m.recipient === "Claire Dubois"; })[0];
    expect(claire.text).toContain("Message initial");
    expect(claire.text).toContain("Radar primaire : HORS SERVICE");
    expect(claire.text).toContain("Rétablissement prévu : 14:00");
    t.destroy();
  });

  it("a removed recipient stays removed after the update", function () {
    var t = mount(true);
    t.act("inform");
    t.root.querySelector("input[data-id=\"c3\"]").click();
    t.act("generate");
    t.flush();
    sendV1(t);
    t.click("Simulate record update");
    t.act("inform");
    expect(t.root.querySelector(".body").textContent).toContain("6 people will be contacted");
    expect(t.root.querySelector("input[data-id=\"c3\"]").checked).toBe(false);
    t.destroy();
  });
});
