describe("render", function () {
  var D = SkyNet.data, L = SkyNet.lib, G = D.glossary, v1 = D.records[0], v2 = D.records[1], v3 = D.records[2];
  var tok = "{{fact:surveillance_data}}";

  it("renders degraded in FR and DE (v2)", function () {
    expect(L.render(tok, "FR", v2, G, { label: "x" }).text).toBe("Données de surveillance : DÉGRADÉ");
    expect(L.render(tok, "DE", v2, G, { label: "x" }).text).toBe("Überwachungsdaten: EINGESCHRÄNKT");
    expect(L.render(tok, "EN", v2, G, { label: "x" }).text).toBe("Surveillance data: DEGRADED");
  });
  it("renders OPERATIONAL in v3", function () {
    expect(L.render(tok, "EN", v3, G, { label: "x" }).text).toBe("Surveillance data: OPERATIONAL");
    expect(L.render("{{fact:primary_radar}}", "FR", v3, G, { label: "x" }).text).toBe("Radar primaire : OPÉRATIONNEL");
  });
  it("chips carry the right sourceField", function () {
    var tpl = "{{fact:surveillance_data}}\n{{fact:datalink}}\n{{time:expected}} {{time:next_update}}";
    var r = L.render(tpl, "EN", v2, G, { label: "x", nextUpdate: "16:30" });
    var chips = r.segments.filter(function (s) { return s.type === "chip"; });
    expect(chips.map(function (c) { return c.sourceField; })).toEqual(["degraded", "affected", "expected", "next_update"]);
    expect(chips[2].value).toBe("16:00");
    expect(chips[3].value).toBe("16:30");
  });
  it("renders heading words and ids", function () {
    expect(L.render("[{{id}}] {{h:expected}}", "DE", v1, G, { label: "x" }).text).toBe("[INC00123] Erwartete Behebung");
  });
  it("label renders as Initial / Update 1 / Resolved", function () {
    function txt(n, rec, lang) { return L.labelText(L.getLabel(n, rec), lang || "EN", G); }
    expect(txt(0, v1)).toBe("Initial");
    expect(txt(1, v2)).toBe("Update 1");
    expect(txt(2, v3)).toBe("Resolved");
    expect(txt(1, v2, "FR")).toBe("Mise à jour 1");
    expect(L.render("{{label}}", "EN", v2, G, { label: txt(1, v2) }).text).toBe("Update 1");
  });
});
