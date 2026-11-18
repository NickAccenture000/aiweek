window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
SkyNet.data.records = [
  { id: "INC00123", title: "Primary radar failure", version: 1,
    major: false, resolved: false, updatedAt: "2026-11-20T13:05",
    affected: ["primary_radar"],
    degraded: ["surveillance_data"],
    working: ["voice_comm", "backup_radar", "datalink"],
    expected: "14:00" },
  { id: "INC00123", title: "Primary radar failure", version: 2,
    major: true, resolved: false, updatedAt: "2026-11-20T13:40",
    affected: ["primary_radar", "datalink"],
    degraded: ["surveillance_data"],
    working: ["voice_comm", "backup_radar"],
    expected: "16:00" },
  { id: "INC00123", title: "Primary radar failure", version: 3,
    major: true, resolved: true, updatedAt: "2026-11-20T15:50",
    affected: [], degraded: [],
    working: ["primary_radar", "datalink", "surveillance_data", "voice_comm", "backup_radar"],
    expected: null }
];
