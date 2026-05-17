// AppShells.jsx — Desktop shell (header + sidebar) + Mobile chrome (bottom nav).
// These wrap dashboard / projects / workspace / docs / status content.

const { createElement: h } = React;

// ── DESKTOP ───────────────────────────────────────────────
const DesktopHeader = () => {
  const { t, lang, setLang, setRoute, setActiveProject } = useApp();
  const meta = LANG_META[lang];
  const cycleLang = () => {
    const keys = Object.keys(LANG_META);
    setLang(keys[(keys.indexOf(lang) + 1) % keys.length]);
  };
  return h("header", {
    style: {
      height: 64, flex: "0 0 auto", display: "flex", alignItems: "center",
      padding: "0 24px", gap: 16,
      background: "rgba(14,14,14,0.92)", backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    },
  },
    h("button", {
      onClick: () => { setActiveProject(null); setRoute("dashboard"); },
      style: {
        display: "flex", alignItems: "center", gap: 10, background: "none", border: "none",
        cursor: "pointer", padding: 0,
      },
    },
      h(Wordmark, { size: 22 }),
      h("span", {
        style: {
          fontFamily: "Manrope", fontWeight: 900, fontSize: 8, letterSpacing: "0.2em",
          padding: "2px 7px", borderRadius: 5,
          background: "rgba(255,139,155,0.15)", color: "#ff8b9b",
          border: "1px solid rgba(255,139,155,0.25)",
        },
      }, "BETA"),
    ),
    // search
    h("div", {
      style: {
        flex: 1, maxWidth: 420, height: 36, borderRadius: 10,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        color: "#767575",
      },
    },
      h(Icon, { name: "search", size: 14 }),
      h("span", { style: { fontFamily: "Inter", fontSize: 12 } }, t.searchPlaceholder),
      h("span", {
        style: {
          marginLeft: "auto", padding: "2px 6px", borderRadius: 5,
          fontSize: 9, fontWeight: 700, color: "#adaaaa",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          fontFamily: "Inter",
        },
      }, "⌘K"),
    ),
    h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
      h("button", {
        onClick: cycleLang,
        style: {
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 12px", height: 34, borderRadius: 9,
          background: "rgba(255,139,155,0.08)", border: "1px solid rgba(255,139,155,0.2)",
          color: "#ff8b9b", cursor: "pointer", fontSize: 11, fontWeight: 700,
          fontFamily: "Manrope", letterSpacing: ".08em",
        },
      },
        h(Icon, { name: "globe", size: 12 }),
        meta.short, " · ", meta.native,
      ),
      h(Button, { variant: "icon", size: "md", icon: "bell" }),
      h("div", { style: { display: "flex", alignItems: "center", gap: 8, paddingLeft: 10, borderLeft: "1px solid rgba(255,255,255,0.08)" } },
        h(Avatar, { kind: "user", size: 30, label: "A" }),
        h("div", { style: { display: "flex", flexDirection: "column", lineHeight: 1.2 } },
          h("span", { style: { fontFamily: "Manrope", fontWeight: 700, fontSize: 11, color: "#fff" } }, "Amadou"),
          h("span", { style: { fontFamily: "Inter", fontSize: 9, color: "#767575" } }, "amadou@gando.ai"),
        ),
      ),
    ),
  );
};

const DesktopSidebar = () => {
  const { t, route, setRoute, setActiveProject, projects } = useApp();
  const nav = [
    { id: "dashboard", label: t.dashboardNav,  icon: "dashboard" },
    { id: "projects",  label: t.projectsNav,   icon: "folder", badge: projects.length },
    { id: "assets",    label: t.assetsNav,     icon: "globe" },
    { id: "settings",  label: t.settingsNav,   icon: "settings" },
    { id: "team",      label: t.teamHubLabel,  icon: "users" },
  ];
  const footer = [
    { id: "docs",   label: t.docsNav,   icon: "book" },
    { id: "status", label: t.statusNav, icon: "activity" },
  ];
  return h("aside", {
    style: {
      width: 248, flex: "0 0 248px",
      borderRight: "1px solid rgba(255,255,255,0.05)",
      padding: "20px 0", display: "flex", flexDirection: "column",
      background: "#0b0b0b",
    },
  },
    h("div", { style: { padding: "0 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" } },
      h(Eyebrow, {}, t.workspace),
      h("div", { style: { marginTop: 6, display: "flex", alignItems: "center", gap: 8 } },
        h("div", {
          style: {
            width: 26, height: 26, borderRadius: 7,
            background: "rgba(255,139,155,0.12)",
            border: "1px solid rgba(255,139,155,0.3)",
            display: "grid", placeItems: "center", flex: "0 0 auto",
          },
        }, h(GandoMark, { size: 16, variant: "gradient" })),
        h("span", { style: { fontFamily: "Manrope", fontWeight: 800, fontSize: 13, color: "#fff" } }, "Amadou's"),
      ),
    ),
    h("div", { style: { padding: "12px 0", display: "flex", flexDirection: "column", gap: 2 } },
      nav.map(item => {
        const isActive = route === item.id;
        return h("button", {
          key: item.id,
          onClick: () => { setActiveProject(null); setRoute(item.id); },
          style: {
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 20px", height: 40,
            paddingLeft: isActive ? 16 : 20,
            background: isActive ? "linear-gradient(to right, rgba(255,139,155,0.12), transparent)" : "transparent",
            borderLeft: `4px solid ${isActive ? "#ff8b9b" : "transparent"}`,
            color: isActive ? "#fff" : "#adaaaa",
            cursor: "pointer", border: "none",
            fontFamily: "Inter", fontSize: 12,
            fontWeight: isActive ? 700 : 500,
            textAlign: "left",
          },
        },
          h(Icon, { name: item.icon, size: 14, style: { color: isActive ? "#ff8b9b" : "currentColor" } }),
          h("span", { style: { flex: 1 } }, item.label),
          item.badge != null && h("span", {
            style: {
              fontSize: 9, fontWeight: 800, fontFamily: "Manrope",
              padding: "1px 7px", borderRadius: 9999,
              background: "rgba(255,255,255,0.06)", color: "#adaaaa",
            },
          }, item.badge),
        );
      }),
    ),
    // new project
    h("div", { style: { padding: "4px 20px 12px" } },
      h(Button, { variant: "primary", size: "md", icon: "plus", style: { width: "100%" } }, t.newProject),
    ),
    h("div", { style: { marginTop: "auto", padding: "10px 0 0", borderTop: "1px solid rgba(255,255,255,0.05)" } },
      footer.map(item => {
        const isActive = route === item.id;
        return h("button", {
          key: item.id,
          onClick: () => { setActiveProject(null); setRoute(item.id); },
          style: {
            display: "flex", alignItems: "center", gap: 12,
            padding: "8px 20px", height: 34,
            background: "transparent", border: "none",
            color: isActive ? "#fff" : "#767575",
            cursor: "pointer", fontFamily: "Inter", fontSize: 11,
            fontWeight: isActive ? 700 : 500, textAlign: "left", width: "100%",
          },
        },
          h(Icon, { name: item.icon, size: 12 }),
          item.label,
        );
      }),
    ),
  );
};

const DesktopShell = ({ children }) =>
  h("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a", color: "#fff" } },
    h(DesktopHeader, {}),
    h("div", { style: { flex: 1, minHeight: 0, display: "flex" } },
      h(DesktopSidebar, {}),
      h("main", {
        style: {
          flex: 1, minWidth: 0, overflow: "auto",
          padding: "24px 32px",
        },
      }, children),
    ),
  );

// ── MOBILE ──────────────────────────────────────────────
const MobileTopBar = ({ title, trailing }) => {
  const { lang, setLang } = useApp();
  const meta = LANG_META[lang];
  const cycleLang = () => {
    const keys = Object.keys(LANG_META);
    setLang(keys[(keys.indexOf(lang) + 1) % keys.length]);
  };
  return h("div", {
    style: {
      height: 52, flex: "0 0 auto", display: "flex", alignItems: "center",
      padding: "0 18px", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.05)",
      background: "rgba(10,10,10,0.92)", backdropFilter: "blur(20px)",
      position: "relative", zIndex: 10,
    },
  },
    title
      ? h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 16, color: "#fff", flex: 1, letterSpacing: "-0.01em" } }, title)
      : h("div", { style: { display: "flex", alignItems: "center", gap: 8, flex: 1 } },
          h(Wordmark, { size: 18 }),
        ),
    h("button", {
      onClick: cycleLang,
      style: {
        display: "flex", alignItems: "center", gap: 4,
        padding: "5px 9px", borderRadius: 9999,
        background: "rgba(255,139,155,0.08)", border: "1px solid rgba(255,139,155,0.2)",
        color: "#ff8b9b", cursor: "pointer", fontSize: 10, fontWeight: 800,
        fontFamily: "Manrope", letterSpacing: ".08em",
      },
    },
      h(Icon, { name: "globe", size: 10 }),
      meta.short,
    ),
    trailing,
  );
};

const MobileBottomNav = () => {
  const { t, route, setRoute, setActiveProject } = useApp();
  const items = [
    { id: "dashboard", icon: "dashboard", label: t.dashboardNav },
    { id: "projects",  icon: "folder",    label: t.projectsNav },
    { id: "new",       icon: "plus",      label: t.newProject, primary: true },
    { id: "docs",      icon: "book",      label: t.docsNav },
    { id: "status",    icon: "activity",  label: t.statusNav },
  ];
  return h("div", {
    style: {
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20,
      height: 72, paddingBottom: 10,
      background: "rgba(10,10,10,0.92)", backdropFilter: "blur(20px)",
      borderTop: "1px solid rgba(255,255,255,0.05)",
      display: "flex", alignItems: "flex-start", justifyContent: "space-around",
      paddingTop: 8,
    },
  },
    items.map(item => {
      const isActive = route === item.id;
      if (item.primary) {
        return h("button", {
          key: item.id,
          onClick: () => { setActiveProject(null); setRoute("dashboard"); },
          style: {
            width: 50, height: 50, borderRadius: 16, border: "none",
            background: "linear-gradient(135deg,#ff8b9b,#fd8b00)",
            color: "#0a0a0a", display: "grid", placeItems: "center",
            cursor: "pointer", boxShadow: "0 12px 30px -6px rgba(255,139,155,0.5)",
            marginTop: -8,
          },
        }, h(Icon, { name: item.icon, size: 22 }));
      }
      return h("button", {
        key: item.id,
        onClick: () => { setActiveProject(null); setRoute(item.id); },
        style: {
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          background: "transparent", border: "none",
          color: isActive ? "#ff8b9b" : "#767575", cursor: "pointer",
          fontFamily: "Inter", fontSize: 9, fontWeight: 600,
          padding: "4px 0",
        },
      },
        h(Icon, { name: item.icon, size: 18 }),
        h("span", {}, item.label),
      );
    }),
  );
};

const MobileShell = ({ children, title }) =>
  h("div", { style: { flex: 1, display: "flex", flexDirection: "column", background: "#0a0a0a", color: "#fff", position: "relative", overflow: "hidden" } },
    h(MobileTopBar, { title }),
    h("div", { style: { flex: 1, minHeight: 0, overflow: "auto", paddingBottom: 72 } }, children),
    h(MobileBottomNav, {}),
  );

Object.assign(window, { DesktopShell, MobileShell, DesktopHeader, DesktopSidebar, MobileTopBar, MobileBottomNav });
