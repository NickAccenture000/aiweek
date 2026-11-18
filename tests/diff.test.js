describe("diff", function () {
  var D = SkyNet.data, L = SkyNet.lib;
  function pick(d, fn) { return d.filter(fn)[0]; }

  it("v1 -> v2 reports expected, major and datalink", function () {
    var d = L.diffRecords(D.records[0], D.records[1]);
    expect(pick(d, function (x) { return x.field === "expected"; })).toEqual({ field: "expected", from: "14:00", to: "16:00" });
    expect(pick(d, function (x) { return x.field === "major"; })).toEqual({ field: "major", from: false, to: true });
    expect(pick(d, function (x) { return x.system === "datalink"; })).toEqual({ field: "system", system: "datalink", from: "working", to: "affected" });
    expect(d.filter(function (x) { return x.system === "primary_radar"; })).toHaveLength(0);
  });
  it("no last sent record means no diff", function () {
    expect(L.diffRecords(null, D.records[0])).toHaveLength(0);
  });
});
