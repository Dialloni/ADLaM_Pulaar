// StatusScreen.jsx — live system health page, desktop + mobile.

const { createElement: h, useState, useEffect } = React;

const SERVICES = [
  { id: "server",   key: "statusServer",   latency: 42,  uptime: 99.99, trend: [98, 100, 99, 100, 98, 100, 99, 100, 100, 99, 100, 100] },
  { id: "ai",       key: "statusAI",       latency: 189, uptime: 99.87, trend: [95, 98, 97, 99, 96, 98, 99, 97, 98, 99, 99, 98] },
  { id: "firebase", key: "statusFirebase", latency: 28,  uptime: 99.95, trend: [100, 99, 100, 100, 99, 100, 100, 100, 99, 100, 100, 100] },
];

const INCIDENTS = [
  { id: "i1", date: "Today · 14:22 UTC", title: "All systems operational",          kind: "ok",   body: "No incidents to report." },
  { id: "i2", date: "Yesterday · 09:14 UTC", title: "Elevated model latency resolved", kind: "resolved", body: "Generation latency returned to baseline after model router rebalanced. Affected users: <3%." },
  { id: "i3", date: "3 days ago",       title: "Scheduled database maintenance",     kind: "scheduled", body: "Firestore region migration completed on schedule. Zero downtime." },
];

const Sparkline = ({ data, color }) => {
  const w = 100, hgt = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const range = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = hgt - ((v - min) / range) * hgt;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return h("svg", { width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, style: { display: "block" } },
    h("polyline", {
      points: pts, fill: "none", stroke: color, strokeWidth: 1.5,
      strokeLinecap: "round", strokeLinejoin: "round",
    }),
  );
};

const StatusPill = ({ status }) => {
  const color = status === "operational" ? "#4ade80" : status === "degraded" ? "#fd8b00" : "#ff5f57";
  return h("span", {
    style: {
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 9999,
      background: `${color}14`, border: `1px solid ${color}40`,
      color, fontFamily: "Manrope", fontWeight: 800, fontSize: 10,
      textTransform: "uppercase", letterSpacing: ".15em",
    },
  },
    h("span", { style: { width: 6, height: 6, borderRadius: 9999, background: color, boxShadow: `0 0 8px ${color}` } }),
    status,
  );
};

// ── DESKTOP ──────────────────────────────────────────────
const StatusDesktop = () => {
  const { t } = useApp();
  // tiny ticking latency for liveness
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 2400);
    return () => clearInterval(id);
  }, []);

  return h("div", { style: { display: "flex", flexDirection: "column", gap: 22 } },
    // header
    h("div", {},
      h(Eyebrow, { color: "#4ade80" }, "LIVE · ALL SYSTEMS NORMAL"),
      h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 36, letterSpacing: "-0.035em", color: "#fff", marginTop: 6, lineHeight: 1 } }, t.statusPageTitle),
      h("p", { style: { fontFamily: "Inter", fontSize: 13, color: "#adaaaa", marginTop: 8, maxWidth: 560 } }, t.statusPageSubtitle),
    ),

    // overall banner
    h(Card, { style: { padding: 22, display: "flex", alignItems: "center", gap: 20 }, gradientBar: true },
      h("div", {
        style: {
          width: 56, height: 56, borderRadius: 16,
          background: "radial-gradient(circle, rgba(74,222,128,0.2), transparent 70%)",
          display: "grid", placeItems: "center",
          border: "1px solid rgba(74,222,128,0.3)",
        },
      }, h("div", { style: { width: 14, height: 14, borderRadius: 9999, background: "#4ade80", boxShadow: "0 0 20px #4ade80" } })),
      h("div", { style: { flex: 1 } },
        h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 20, color: "#fff", letterSpacing: "-0.02em" } },
          t.statusOperational),
        h("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#adaaaa", marginTop: 4 } },
          `${t.statusLastChecked} · ${new Date(Date.now() - (tick % 5) * 1000).toLocaleTimeString()}`),
      ),
      h("div", { style: { display: "flex", gap: 18 } },
        [
          { label: "Uptime (30d)", value: "99.94%", color: "#4ade80" },
          { label: "Avg Latency",  value: `${86 + (tick % 6)}ms`,  color: "#ff8b9b" },
          { label: "Requests / s", value: "1.4k",  color: "#fd8b00" },
        ].map(s =>
          h("div", { key: s.label, style: { textAlign: "right" } },
            h("div", {
              style: {
                fontFamily: "Manrope", fontWeight: 900, fontSize: 20, color: s.color, letterSpacing: "-0.02em",
                fontFeatureSettings: '"tnum"',
              },
            }, s.value),
            h("div", { style: { fontFamily: "Manrope", fontWeight: 700, fontSize: 9, color: "#767575", textTransform: "uppercase", letterSpacing: ".12em", marginTop: 2 } }, s.label),
          ),
        ),
      ),
    ),

    // service grid
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 } },
      SERVICES.map(s =>
        h(Card, { key: s.id, style: { padding: 18 } },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("div", { style: { fontFamily: "Manrope", fontWeight: 800, fontSize: 13, color: "#fff", letterSpacing: "-0.01em" } }, t[s.key]),
            h(StatusPill, { status: "operational" }),
          ),
          h("div", { style: { marginTop: 18, marginBottom: 4 } }, h(Sparkline, { data: s.trend, color: "#4ade80" })),
          h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" } },
            h("div", {},
              h("div", { style: { fontFamily: "Manrope", fontWeight: 700, fontSize: 9, color: "#767575", textTransform: "uppercase", letterSpacing: ".12em" } }, t.latencyLabel),
              h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 15, color: "#fff", marginTop: 2, fontFeatureSettings: '"tnum"' } }, `${s.latency + (tick % 5)}ms`),
            ),
            h("div", { style: { textAlign: "right" } },
              h("div", { style: { fontFamily: "Manrope", fontWeight: 700, fontSize: 9, color: "#767575", textTransform: "uppercase", letterSpacing: ".12em" } }, t.uptimeLabel),
              h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 15, color: "#4ade80", marginTop: 2, fontFeatureSettings: '"tnum"' } }, `${s.uptime}%`),
            ),
          ),
        ),
      ),
    ),

    // incident log
    h(Card, { style: { padding: 22 } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
        h("div", {},
          h(Eyebrow, {}, "INCIDENT LOG"),
          h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 18, color: "#fff", marginTop: 4, letterSpacing: "-0.02em" } }, "Past 7 days"),
        ),
        h(Button, { variant: "ghost", size: "sm", icon: "download" }, "Subscribe"),
      ),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 2 } },
        INCIDENTS.map((inc, i) =>
          h("div", {
            key: inc.id,
            style: {
              display: "flex", gap: 16, padding: "14px 0",
              borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
            },
          },
            h("div", {
              style: {
                width: 12, height: 12, flex: "0 0 12px", marginTop: 3, borderRadius: 9999,
                background: inc.kind === "ok" ? "#4ade80" : inc.kind === "resolved" ? "#fd8b00" : "#adaaaa",
                boxShadow: `0 0 10px ${inc.kind === "ok" ? "#4ade80" : inc.kind === "resolved" ? "#fd8b00" : "transparent"}`,
              },
            }),
            h("div", { style: { flex: 1 } },
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
                h("div", { style: { fontFamily: "Manrope", fontWeight: 800, fontSize: 13, color: "#fff" } }, inc.title),
                h("div", { style: { fontFamily: "Inter", fontSize: 10, color: "#767575" } }, inc.date),
              ),
              h("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#adaaaa", marginTop: 4, lineHeight: 1.55 } }, inc.body),
            ),
          ),
        ),
      ),
    ),
  );
};

// ── MOBILE ─────────────────────────────────────────────
const StatusMobile = () => {
  const { t } = useApp();
  return h("div", { style: { flex: 1, overflow: "auto", padding: "16px 16px 80px", background: "#0a0a0a", display: "flex", flexDirection: "column", gap: 14 } },
    h("div", {},
      h(Eyebrow, { color: "#4ade80" }, "ALL SYSTEMS NORMAL"),
      h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 22, color: "#fff", marginTop: 4, letterSpacing: "-0.02em" } }, t.statusPageTitle),
    ),
    h("div", {
      style: {
        padding: 16, borderRadius: 14,
        background: "linear-gradient(135deg, rgba(74,222,128,0.12), rgba(74,222,128,0.02))",
        border: "1px solid rgba(74,222,128,0.2)",
        display: "flex", alignItems: "center", gap: 14,
      },
    },
      h("div", { style: { width: 12, height: 12, borderRadius: 9999, background: "#4ade80", boxShadow: "0 0 12px #4ade80" } }),
      h("div", {},
        h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 14, color: "#fff" } }, t.statusOperational),
        h("div", { style: { fontFamily: "Inter", fontSize: 10, color: "#adaaaa", marginTop: 2 } }, "99.94% uptime · 30 days"),
      ),
    ),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
      SERVICES.map(s =>
        h("div", {
          key: s.id,
          style: { padding: 14, background: "#131313", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 },
        },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("div", { style: { fontFamily: "Manrope", fontWeight: 800, fontSize: 13, color: "#fff" } }, t[s.key]),
            h(StatusPill, { status: "operational" }),
          ),
          h(Sparkline, { data: s.trend, color: "#4ade80" }),
          h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: "Manrope", fontSize: 10, color: "#adaaaa" } },
            h("span", {}, `${s.latency}ms · ${t.latencyLabel.toLowerCase()}`),
            h("span", { style: { color: "#4ade80", fontWeight: 800, fontFeatureSettings: '"tnum"' } }, `${s.uptime}% up`),
          ),
        ),
      ),
    ),
  );
};

Object.assign(window, { StatusDesktop, StatusMobile });
