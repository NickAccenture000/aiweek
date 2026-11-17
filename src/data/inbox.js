window.SkyNet = window.SkyNet || { data: {}, lib: {}, ui: {} };
// Inbox entries. INC00123 is the live incident (driven by records.js). The others are static
// placeholders so the inbox looks like a real queue; they have no stakeholder messaging in this demo.
SkyNet.data.inbox = [
  { id: "INC00123", live: true },
  { id: "INC00124", live: false, title: "Weather display lag at Zurich TWR", severity: "minor", state: "Open", time: "12:48",
    note: "Minor incident. No stakeholder action required." },
  { id: "INC00119", live: false, title: "Voice recorder unit fault", severity: "minor", state: "Resolved", time: "09:12",
    note: "Resolved earlier today. No stakeholder action required." }
];
