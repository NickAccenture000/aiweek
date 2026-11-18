describe("checks", function () {
  var D = SkyNet.data, L = SkyNet.lib, G = D.glossary, R = D.records;
  function rec(v) { return R[v - 1]; }
  function find(v, role, lang) {
    return D.drafts.filter(function (x) { return x.recordVersion === v && x.role === role && x.lang === lang; })[0];
  }
  function en(d) { return find(d.recordVersion, d.role, "EN"); }
  function run(d, record, enD) { return L.runChecks(d, enD || en(d), record || rec(d.recordVersion), G, d.role); }
  function failed(res) { return res.filter(function (c) { return !c.pass; }).map(function (c) { return c.id; }); }
  function clone(d, tpl) { return { recordVersion: d.recordVersion, role: d.role, lang: d.lang, template: tpl }; }

  it("zero-contradiction proof: only the planted v2 ENG FR draft fails", function () {
    expect(D.drafts).toHaveLength(22);
    var bad = D.drafts.filter(function (d) { return failed(run(d)).length > 0; });
    expect(bad).toHaveLength(1);
    expect([bad[0].recordVersion, bad[0].role, bad[0].lang]).toEqual([2, "ENGINEERING", "FR"]);
  });
  it("planted draft fails no_free_facts, coverage and language_parity; fix makes it pass", function () {
    var d = find(2, "ENGINEERING", "FR"), res = run(d);
    expect(failed(res)).toEqual(["no_free_facts", "coverage", "language_parity"]);
    var nff = res.filter(function (c) { return c.id === "no_free_facts"; })[0];
    expect(nff.message).toContain("Données de surveillance : HORS SERVICE");
    expect(failed(run(clone(d, nff.fix)))).toEqual([]);
  });
  it("{{fact:radar_x}} fails values_exact", function () {
    var d = find(1, "ATCO_SUPERVISOR", "EN");
    expect(failed(run(clone(d, d.template + "\n{{fact:radar_x}}")))).toContain("values_exact");
  });
  it("removing a token from a DE draft fails language_parity", function () {
    var d = find(2, "ATCO_SUPERVISOR", "DE");
    expect(failed(run(clone(d, d.template.replace("{{fact:datalink}}\n", ""))))).toContain("language_parity");
  });
  it("removing a required system from EN and DE fails coverage for both", function () {
    var enD = find(2, "ATCO_SUPERVISOR", "EN"), deD = find(2, "ATCO_SUPERVISOR", "DE");
    var enBad = clone(enD, enD.template.replace("{{fact:datalink}}\n", ""));
    var deBad = clone(deD, deD.template.replace("{{fact:datalink}}\n", ""));
    expect(failed(run(enBad, null, enBad))).toContain("coverage");
    expect(failed(run(deBad, null, enBad))).toContain("coverage");
    expect(failed(run(deBad, null, enBad))).not.toContain("language_parity");
  });
  it("a v3 draft containing {{time:expected}} fails values_exact", function () {
    var d = find(3, "ATCO_SUPERVISOR", "EN");
    expect(failed(run(clone(d, d.template + "\n{{time:expected}}")))).toContain("values_exact");
  });
  it("a v1 draft checked against the v2 record fails up_to_date", function () {
    expect(failed(run(find(1, "ATCO_SUPERVISOR", "EN"), rec(2)))).toContain("up_to_date");
  });
  it("matching is whole-word and case-insensitive across languages", function () {
    var d = find(1, "ATCO_SUPERVISOR", "EN");
    expect(failed(run(clone(d, d.template + "\nsprechfunk ist hors service")))).toContain("no_free_facts");
    expect(failed(run(clone(d, d.template + "\nOperationalize the plan.")))).not.toContain("no_free_facts");
  });
  it("resolved drafts must list every system", function () {
    var d = find(3, "MANAGEMENT", "EN");
    expect(failed(run(clone(d, d.template.replace("{{fact:voice_comm}}\n", ""))))).toContain("coverage");
  });
});
