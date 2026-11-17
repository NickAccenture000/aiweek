window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
// notified: "always" | "major". required: record lists whose systems must appear while not resolved.
SkyNet.data.roleRules = {
  ATCO_SUPERVISOR: { notified: "always", required: ["affected", "degraded", "working"], tone: "Operational impact, what still works" },
  ENGINEERING:     { notified: "always", required: ["affected", "degraded", "working"], tone: "Technical" },
  MANAGEMENT:      { notified: "major",  required: ["affected", "degraded"],            tone: "1-2 short lines, business impact" }
};
