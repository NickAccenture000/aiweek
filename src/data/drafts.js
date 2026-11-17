window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
// Content pack: pre-written drafts (simulated "agents"). Facts only appear as {{tokens}};
// free text lines are audience wording and never name a system or a status.
(function () {
  var ROLES = { A: "ATCO_SUPERVISOR", E: "ENGINEERING", M: "MANAGEMENT" };
  var FREE = {
    ATCO_SUPERVISOR: {
      EN: { open: "Apply reduced-capacity procedures.", done: "Resume normal procedures." },
      DE: { open: "Verfahren für reduzierte Kapazität anwenden.", done: "Normale Verfahren wieder aufnehmen." },
      FR: { open: "Appliquer les procédures à capacité réduite.", done: "Reprendre les procédures normales." }
    },
    ENGINEERING: {
      EN: { open: "Investigation ongoing.", done: "Fault cleared, monitoring continues." },
      DE: { open: "Analyse läuft.", done: "Störung behoben, Beobachtung läuft weiter." },
      FR: { open: "Analyse en cours.", done: "Défaut corrigé, suivi en cours." }
    },
    MANAGEMENT: {
      EN: { open: "Air traffic capacity reduced.", done: "Normal operations restored." },
      DE: { open: "Flugverkehrskapazität reduziert.", done: "Normalbetrieb wiederhergestellt." }
    }
  };
  var ORDER = {
    1: ["primary_radar", "surveillance_data", "voice_comm", "backup_radar", "datalink"],
    2: ["primary_radar", "datalink", "surveillance_data", "voice_comm", "backup_radar"],
    3: ["primary_radar", "datalink", "surveillance_data", "voice_comm", "backup_radar"]
  };
  var MGMT_ORDER = { 2: ["primary_radar", "datalink", "surveillance_data"], 3: ORDER[3] };

  function build(version, role, lang) {
    var resolved = version === 3;
    var systems = role === ROLES.M ? MGMT_ORDER[version] : ORDER[version];
    var sep = lang === "FR" ? " : " : ": ";
    var lines = ["[{{id}}] {{label}}"];
    systems.forEach(function (s) { lines.push("{{fact:" + s + "}}"); });
    lines.push(FREE[role][lang][resolved ? "done" : "open"]);
    if (!resolved) {
      lines.push("{{h:expected}}" + sep + "{{time:expected}}");
      lines.push("{{h:next_update}}" + sep + "{{time:next_update}}");
    }
    return lines.join("\n");
  }

  var drafts = [];
  [1, 2, 3].forEach(function (v) {
    var roles = v === 1 ? [ROLES.A, ROLES.E] : [ROLES.A, ROLES.E, ROLES.M];
    roles.forEach(function (role) {
      (role === ROLES.M ? ["EN", "DE"] : ["EN", "DE", "FR"]).forEach(function (lang) {
        drafts.push({ recordVersion: v, role: role, lang: lang, template: build(v, role, lang) });
      });
    });
  });

  // Planted error (required): v2 x ENGINEERING x FR states a status as free text.
  drafts.forEach(function (d) {
    if (d.recordVersion === 2 && d.role === ROLES.E && d.lang === "FR") {
      d.template = d.template.replace("{{fact:surveillance_data}}", "Données de surveillance : HORS SERVICE");
    }
  });

  SkyNet.data.drafts = drafts;
})();
