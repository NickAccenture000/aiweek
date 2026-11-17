describe("recipients", function () {
  var D = SkyNet.data, L = SkyNet.lib, v1 = D.records[0], v2 = D.records[1];
  function rec(r, o) { return L.getRecipients(r, D.contacts, D.roleRules, o); }
  function ids(list) { return list.map(function (c) { return c.id; }); }

  it("v1 has 5 recipients and 6 draft keys incl. ENG EN review-only", function () {
    var r = rec(v1), keys = L.getDraftKeys(r);
    expect(r).toHaveLength(5);
    expect(keys).toHaveLength(6);
    var engEn = keys.filter(function (k) { return k.key === "ENGINEERING:EN"; })[0];
    expect(engEn.reviewOnly).toBe(true);
  });
  it("v2 has 7 recipients and 8 draft keys", function () {
    expect(rec(v2)).toHaveLength(7);
    expect(L.getDraftKeys(rec(v2))).toHaveLength(8);
  });
  it("inactive Marco Rossi is never included", function () {
    expect(ids(rec(v1))).not.toContain("c8");
    expect(ids(rec(v2))).not.toContain("c8");
    expect(ids(rec(v1, { added: ["c8"], removed: [] }))).not.toContain("c8");
  });
  it("a manually removed contact stays removed after the update to v2", function () {
    var o = { added: [], removed: ["c3"] };
    expect(ids(rec(v1, o))).not.toContain("c3");
    expect(ids(rec(v2, o))).not.toContain("c3");
    expect(rec(v2, o)).toHaveLength(6);
  });
  it("a manually added contact is included", function () {
    expect(ids(rec(v1, { added: ["c7"], removed: [] }))).toContain("c7");
  });
});
