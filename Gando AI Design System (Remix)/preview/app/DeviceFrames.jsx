// DeviceFrames.jsx — Desktop browser chrome + phone bezel for the Full App page.
// These are visual frames only; the app content is whatever children pass in.

const { createElement: h } = React;

// ─── Desktop browser window ──────────────────────────────
// Realistic Chrome-ish chrome with traffic lights, tab, URL bar.
const DesktopFrame = ({ children, width = 1280, height = 800, label = "gando.ai", style }) =>
  h("div", {
    style: {
      width, height, borderRadius: 14, overflow: "hidden",
      background: "#0a0a0a",
      boxShadow: "0 60px 120px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
      display: "flex", flexDirection: "column",
      flex: "0 0 auto", ...style,
    },
  },
    // titlebar
    h("div", {
      style: {
        height: 38, background: "linear-gradient(to bottom, #1a1a1a, #141414)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", padding: "0 14px", gap: 12,
        flex: "0 0 auto",
      },
    },
      // traffic lights
      h("div", { style: { display: "flex", gap: 7 } },
        h("div", { style: { width: 12, height: 12, borderRadius: 9999, background: "#ff5f57", border: "0.5px solid rgba(0,0,0,0.15)" } }),
        h("div", { style: { width: 12, height: 12, borderRadius: 9999, background: "#febc2e", border: "0.5px solid rgba(0,0,0,0.15)" } }),
        h("div", { style: { width: 12, height: 12, borderRadius: 9999, background: "#28c840", border: "0.5px solid rgba(0,0,0,0.15)" } }),
      ),
      // tab
      h("div", {
        style: {
          height: 28, minWidth: 240, maxWidth: 340,
          background: "#0a0a0a", borderRadius: "8px 8px 0 0",
          marginTop: 6, marginLeft: 10, padding: "0 12px",
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "Inter", fontSize: 11, color: "#adaaaa",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        },
      },
        // tiny gando mark favicon
        h("svg", { width: 11, height: 11, viewBox: "0 0 64 64", style: { flex: "0 0 auto" } },
          h("defs", {},
            h("linearGradient", { id: "tab-fav", x1: "0", y1: "0", x2: "1", y2: "1" },
              h("stop", { offset: "0%", stopColor: "#ff8b9b" }),
              h("stop", { offset: "100%", stopColor: "#fd8b00" }),
            ),
          ),
          h("path", {
            d: "M20 14 L20 38 Q20 48 30 48 Q42 48 42 36 Q42 26 32 26 L26 26",
            stroke: "url(#tab-fav)", strokeWidth: 7, strokeLinecap: "round",
            strokeLinejoin: "round", fill: "none",
          }),
          h("circle", { cx: 32, cy: 18, r: 5, fill: "#fd8b00" }),
        ),
        h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
        h("svg", { width: 10, height: 10, viewBox: "0 0 24 24", fill: "none", stroke: "#52525b", strokeWidth: 2.5, strokeLinecap: "round" },
          h("path", { d: "M18 6L6 18" }),
          h("path", { d: "M6 6l12 12" }),
        ),
      ),
      // URL bar (fake)
      h("div", {
        style: {
          flex: 1, height: 26, borderRadius: 9999,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", padding: "0 12px", gap: 8,
          fontFamily: "Inter", fontSize: 10, color: "#767575",
          marginLeft: 8,
        },
      },
        h("svg", { width: 10, height: 10, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" },
          h("rect", { x: 3, y: 11, width: 18, height: 10, rx: 2 }),
          h("path", { d: "M7 11V7a5 5 0 0110 0v4" }),
        ),
        h("span", {}, "https://gando.ai/", h("span", { style: { color: "#adaaaa" } }, "dashboard")),
      ),
    ),

    // content
    h("div", { style: { flex: 1, minHeight: 0, overflow: "hidden", position: "relative" } }, children),
  );

// ─── Phone bezel — Gando-styled (not stock iOS) ──────────
// Dynamic island + generic status bar. Content fills the rest.
const PhoneFrame = ({ children, width = 390, height = 844, style, time = "9:41" }) =>
  h("div", {
    style: {
      width, height, borderRadius: 52, overflow: "hidden",
      position: "relative", background: "#0a0a0a",
      boxShadow: "0 40px 80px -10px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.12), inset 0 0 0 2px rgba(255,255,255,0.04)",
      flex: "0 0 auto", ...style,
    },
  },
    // status bar
    h("div", {
      style: {
        position: "absolute", top: 0, left: 0, right: 0, height: 54, zIndex: 30,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 30px 0",
        fontFamily: "-apple-system, system-ui", color: "#fff",
      },
    },
      h("span", { style: { fontSize: 16, fontWeight: 600 } }, time),
      h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
        // signal
        h("svg", { width: 17, height: 11, viewBox: "0 0 17 11" },
          h("rect", { x: 0,  y: 7, width: 3, height: 4,  rx: 0.5, fill: "#fff" }),
          h("rect", { x: 4,  y: 5, width: 3, height: 6,  rx: 0.5, fill: "#fff" }),
          h("rect", { x: 8,  y: 2, width: 3, height: 9,  rx: 0.5, fill: "#fff" }),
          h("rect", { x: 12, y: 0, width: 3, height: 11, rx: 0.5, fill: "#fff" }),
        ),
        // battery
        h("svg", { width: 25, height: 11, viewBox: "0 0 25 11" },
          h("rect", { x: 0.5, y: 0.5, width: 21, height: 10, rx: 2.5, stroke: "#fff", strokeOpacity: 0.45, fill: "none" }),
          h("rect", { x: 2,   y: 2,   width: 18, height: 7,  rx: 1.5, fill: "#fff" }),
          h("rect", { x: 23,  y: 3.5, width: 1.5, height: 4, rx: 0.5, fill: "#fff", fillOpacity: 0.45 }),
        ),
      ),
    ),
    // dynamic island
    h("div", {
      style: {
        position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)",
        width: 120, height: 36, borderRadius: 24, background: "#000", zIndex: 40,
      },
    }),
    // content — reserve top for status bar
    h("div", {
      style: {
        position: "absolute", inset: 0, paddingTop: 54, paddingBottom: 0,
        display: "flex", flexDirection: "column", overflow: "hidden",
      },
    }, children),
    // home indicator
    h("div", {
      style: {
        position: "absolute", left: 0, right: 0, bottom: 0, height: 32, zIndex: 50,
        display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: 8,
        pointerEvents: "none",
      },
    },
      h("div", {
        style: {
          width: 134, height: 5, borderRadius: 9999,
          background: "rgba(255,255,255,0.6)",
        },
      }),
    ),
  );

Object.assign(window, { DesktopFrame, PhoneFrame });
