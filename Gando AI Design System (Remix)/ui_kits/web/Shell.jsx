// App shell: fixed top header + 288px sidebar + main content area.
const { createElement: h, useState } = React;

const Header = ({ lang = "EN", onLangChange, onLogout, user = { name: "Amadou", email: "amadou@gando.ai" } }) =>
  h("header", {
    style: {
      position: "sticky", top: 0, zIndex: 10, height: 72,
      display: "flex", alignItems: "center", padding: "0 32px",
      background: "rgba(14,14,14,0.92)", backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.05)", gap: 20,
    },
  },
    h("div", { style: { display: "flex", alignItems: "center", gap: 14, flex: 1 } },
      h(Wordmark, { size: 26 }),
      h("span", {
        style: {
          fontFamily: "Manrope", fontWeight: 900, fontSize: 9, letterSpacing: "0.2em",
          padding: "3px 8px", borderRadius: 6,
          background: "rgba(255,139,155,0.15)", color: "#ff8b9b",
          border: "1px solid rgba(255,139,155,0.25)",
        },
      }, "BETA"),
    ),
    h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
      h("button", {
        onClick: onLangChange,
        style: {
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 12px", height: 36, borderRadius: 10,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#adaaaa", cursor: "pointer", fontSize: 12, fontWeight: 600,
          fontFamily: "Inter",
        },
      }, h(Icon, { name: "globe", size: 14 }), lang, h(Icon, { name: "chevronD", size: 12 })),
      h(Button, { variant: "icon", size: "md", icon: "bell" }),
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, paddingLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.08)" } },
        h(Avatar, { kind: "user", size: 32, label: user.name }),
        h("div", { style: { display: "flex", flexDirection: "column", lineHeight: 1.2 } },
          h("span", { style: { fontFamily: "Manrope", fontWeight: 700, fontSize: 12, color: "#fff" } }, user.name),
          h("span", { style: { fontFamily: "Inter", fontSize: 10, color: "#767575" } }, user.email),
        ),
        h("button", {
          onClick: onLogout,
          style: {
            width: 32, height: 32, borderRadius: 9999, display: "grid", placeItems: "center",
            background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
            color: "#767575", cursor: "pointer",
          },
          title: "Sign out",
        }, h(Icon, { name: "logout", size: 14 })),
      ),
    ),
  );

const Sidebar = ({ active = "dashboard", onNavigate }) => {
  const nav = [
    { id: "dashboard", label: "Dashboard",  icon: "dashboard" },
    { id: "projects",  label: "Your Projects", icon: "folder" },
    { id: "community", label: "Community",  icon: "users" },
    { id: "docs",      label: "Docs",       icon: "book" },
    { id: "status",    label: "System Status", icon: "activity" },
    { id: "settings",  label: "Settings",   icon: "settings" },
  ];

  return h("aside", {
    style: {
      width: 288, flex: "0 0 288px",
      borderRight: "1px solid rgba(255,255,255,0.05)",
      padding: "24px 0", display: "flex", flexDirection: "column", gap: 2,
      background: "#0e0e0e",
    },
  },
    h("div", {
      style: {
        padding: "0 28px 16px", marginBottom: 8,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      },
    },
      h(Eyebrow, {}, "Workspace"),
      h("div", {
        style: { marginTop: 6, display: "flex", alignItems: "center", gap: 8 },
      },
        h("div", {
          style: {
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(255,139,155,0.12)",
            border: "1px solid rgba(255,139,155,0.3)",
            display: "grid", placeItems: "center", flex: "0 0 auto",
          },
        }, h(GandoMark, { size: 18, variant: "gradient" })),
        h("span", { style: { fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: "#fff" } }, "Amadou's"),
      ),
    ),
    ...nav.map(item => {
      const isActive = item.id === active;
      return h("button", {
        key: item.id,
        onClick: () => onNavigate && onNavigate(item.id),
        style: {
          display: "flex", alignItems: "center", gap: 12,
          padding: "11px 28px", height: 44,
          background: isActive ? "linear-gradient(to right, rgba(255,139,155,0.12), transparent)" : "transparent",
          borderLeft: `4px solid ${isActive ? "#ff8b9b" : "transparent"}`,
          paddingLeft: isActive ? 24 : 28,
          color: isActive ? "#fff" : "#adaaaa",
          cursor: "pointer", border: "none",
          borderBottom: "none", borderRight: "none", borderTop: "none",
          fontFamily: "Inter", fontSize: 13,
          fontWeight: isActive ? 700 : 500,
          transition: "all 180ms cubic-bezier(0.16,1,0.3,1)",
          textAlign: "left", width: "100%",
        },
      },
        h(Icon, { name: item.icon, size: 16, style: { color: isActive ? "#ff8b9b" : "currentColor" } }),
        item.label,
        isActive && h("div", { style: { marginLeft: "auto", width: 4, height: 4, borderRadius: 9999, background: "#ff8b9b" } }),
      );
    }),
    h("div", { style: { marginTop: "auto", padding: "16px 28px", borderTop: "1px solid rgba(255,255,255,0.05)" } },
      h("div", {
        style: {
          padding: 12, borderRadius: 14,
          background: "linear-gradient(135deg, rgba(255,139,155,0.08), rgba(253,139,0,0.08))",
          border: "1px solid rgba(255,139,155,0.2)",
        },
      },
        h(Eyebrow, { color: "#ff8b9b" }, "Upgrade"),
        h("div", { style: { fontFamily: "Manrope", fontWeight: 800, fontSize: 13, color: "#fff", marginTop: 6 } }, "Get Gando Pro"),
        h("div", { style: { fontFamily: "Inter", fontSize: 11, color: "#adaaaa", marginTop: 4, lineHeight: 1.5 } }, "Unlimited apps, faster generation."),
      ),
    ),
  );
};

const Shell = ({ children, active, onNavigate, lang, onLangChange, onLogout, user }) =>
  h("div", { style: { display: "flex", flexDirection: "column", height: "100%", position: "relative" } },
    // ambient glows
    h(GlowOrb, { color: "#ff8b9b", size: 700, x: "0%", y: "0%", opacity: 0.06 }),
    h(GlowOrb, { color: "#fd8b00", size: 700, x: "100%", y: "100%", opacity: 0.06 }),
    h(Header, { lang, onLangChange, onLogout, user }),
    h("div", { style: { display: "flex", flex: 1, minHeight: 0, position: "relative", zIndex: 1 } },
      h(Sidebar, { active, onNavigate }),
      h("main", {
        style: {
          flex: 1, minWidth: 0, overflow: "auto", padding: "32px 40px",
          position: "relative",
        },
      }, children),
    ),
  );

Object.assign(window, { Header, Sidebar, Shell });
