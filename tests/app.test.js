describe("App", function () {
  var made = [];

  function mount() {
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
      click: function (text, within) {
        var b = t.btn(text, within);
        if (!b) throw new Error("button not found: " + text);
        if (b.disabled) throw new Error("button disabled: " + text);
        b.click();
      },
      card: function (role) { return root.querySelector(".card[data-role=\"" + role + "\"]"); },
      approve: function (role) { t.click("Approve", t.card(role)); },
      expand: function (role) { t.click(SkyNet.lib.roleName(role), t.card(role)); },
      expandAndApproveAll: function () {
        root.querySelectorAll(".card").forEach(function (c) {
          var role = c.getAttribute("data-role");
          t.expand(role);
          t.approve(role);
        });
      },
      history: function () {
        return Array.prototype.map.call(root.querySelectorAll(".history-entry h3"), function (h) { return h.textContent; });
      },
      destroy: function () { app.destroy(); root.remove(); }
    };
    made.push(t);
    t.flush();
    return t;
  }

  function sendV1(t) {
    t.expandAndApproveAll();
    t.click("Send to outbox");
  }

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
    var queue = [], root = document.createElement("div");
    document.getElementById("test-root").appendChild(root);
    var app = SkyNet.createApp(root, { clock: { setTimeout: function (fn) { queue.push(fn); } } });
    expect(root.querySelector(".gen-status").textContent).toContain("Writing drafts");
    queue.shift()();
    expect(root.querySelector(".gen-status").textContent).toContain("Checking");
    queue.shift()();
    expect(root.querySelector(".gen-status")).toBe(null);
    app.destroy();
  });

  it("Send is blocked while a check fails; override needs a reason of 10+ characters", function () {
    var t = mount();
    sendV1(t);
    t.click("Simulate record update");
    t.flush();
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
    // overriding resets that role's approval
    t.approve("ENGINEERING");
    expect(t.btn("Send to outbox").disabled).toBe(false);
    t.click("Send to outbox");
    var overrides = t.app.state.history[1].overrides;
    expect(overrides).toHaveLength(1);
    expect(overrides[0].reason).toBe("Verified manually with ENG lead");
    t.destroy();
  });

  it("full demo path: v1 send, update, fix FR issue, send, v3, send", function () {
    var t = mount();
    sendV1(t);
    expect(t.history()).toEqual(["Initial"]);
    t.click("Simulate record update");
    t.flush();
    var banner = t.root.querySelector("[data-testid=diff-banner]").textContent;
    expect(banner).toContain("14:00 → 16:00");
    expect(banner).toContain("Datalink: OPERATIONAL → UNAVAILABLE");
    expect(banner).toContain("Major incident: no → yes");
    expect(t.root.querySelector(".recipients").textContent).toContain("7 recipients");
    expect(t.root.querySelector(".recipients").textContent).toContain("Management added");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "N" }));
    expect(t.root.textContent).toContain("Données de surveillance : HORS SERVICE\" is not a record term");
    t.click("Use record term");
    expect(t.root.querySelector(".strip-text").textContent).toContain("8 ready");
    t.expandAndApproveAll();
    t.click("Send to outbox");
    expect(t.history()).toEqual(["Initial", "Update 1"]);
    t.click("Simulate record update");
    t.flush();
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

  it("Regenerate also resets overrides", function () {
    var t = mount();
    sendV1(t);
    t.click("Simulate record update");
    t.flush();
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
    var msgs = t.app.state.history[0].messages;
    var claire = msgs.filter(function (m) { return m.recipient === "Claire Dubois"; })[0];
    expect(claire.text).toContain("Message initial");
    expect(claire.text).toContain("Radar primaire : HORS SERVICE");
    expect(claire.text).toContain("Rétablissement prévu : 14:00");
    t.destroy();
  });

  it("a removed recipient stays removed after the update", function () {
    var t = mount();
    t.click("5 recipients");
    t.root.querySelector("input[data-id=\"c3\"]").click();
    expect(t.app.derive().recipients).toHaveLength(4);
    t.destroy();
  });
});
