// ProjectsScreen.jsx — library of all projects, desktop + mobile.

const { createElement: h, useState } = React;

const ProjectsDesktop = () => {
  const { t, projects, setActiveProject, setRoute } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = projects.filter(p => {
    if (filter !== "all" && p.status !== filter) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase()) && !p.description.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return h("div", { style: { display: "flex", flexDirection: "column", gap: 22 } },
    h("div", {},
      h(Eyebrow, { color: "#ff8b9b" }, "LIBRARY"),
      h("div", {
        style: {
          fontFamily: "Manrope", fontWeight: 900, fontSize: 36,
          letterSpacing: "-0.035em", color: "#fff", marginTop: 6, lineHeight: 1,
        },
      }, t.projectsPageTitle),
      h("p", { style: { fontFamily: "Inter", fontSize: 13, color: "#adaaaa", marginTop: 8 } }, t.projectsPageSubtitle),
    ),

    // filter bar
    h("div", { style: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" } },
      h(Input, { icon: "search", placeholder: t.searchProjectsPlaceholder, value: q, onChange: e => setQ(e.target.value), style: { flex: 1, minWidth: 260 } }),
      h("div", { style: { display: "flex", padding: 4, gap: 2, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" } },
        ["all", "live", "building", "draft"].map(f =>
          h("button", {
            key: f,
            onClick: () => setFilter(f),
            style: {
              padding: "7px 14px", borderRadius: 9, border: "none", cursor: "pointer",
              background: filter === f ? "linear-gradient(135deg,rgba(255,139,155,0.2),rgba(253,139,0,0.15))" : "transparent",
              color: filter === f ? "#fff" : "#adaaaa",
              fontFamily: "Manrope", fontWeight: 700, fontSize: 11,
              letterSpacing: ".06em", textTransform: "uppercase",
            },
          }, f),
        ),
      ),
      h(Button, { variant: "primary", size: "md", icon: "plus" }, t.newProject),
    ),

    // grid
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 } },
      filtered.map(p => {
        const statusColor = { live: "#4ade80", building: "#fd8b00", draft: "#adaaaa" }[p.status];
        return h(Card, {
          key: p.id, gradientBar: true,
          onClick: () => { setActiveProject(p); },
          style: { padding: 20 },
        },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
            h("div", {
              style: {
                width: 36, height: 36, borderRadius: 12,
                background: "rgba(255,139,155,0.1)", border: "1px solid rgba(255,139,155,0.25)",
                display: "grid", placeItems: "center",
              },
            }, h(GandoMark, { size: 20, variant: "gradient" })),
            h("span", {
              style: {
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 9, fontWeight: 800, color: statusColor,
                textTransform: "uppercase", letterSpacing: ".18em", fontFamily: "Manrope",
                padding: "3px 8px", borderRadius: 9999,
                border: `1px solid ${statusColor}40`, background: `${statusColor}12`,
              },
            },
              h("span", { style: { width: 5, height: 5, borderRadius: 9999, background: statusColor } }),
              p.status,
            ),
          ),
          h("div", {
            style: {
              fontFamily: p.language === "Fulani" ? "'Noto Sans Adlam', Manrope" : "Manrope",
              fontWeight: 900, fontSize: 20, color: "#fff",
              marginTop: 20, letterSpacing: "-0.02em", lineHeight: 1.1,
            },
          }, p.name),
          h("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#767575", marginTop: 6, lineHeight: 1.5, minHeight: 36 } }, p.description),

          h("div", { style: { marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("div", { style: { flex: 1 } },
              h("div", { style: { height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 9999, overflow: "hidden" } },
                h("div", { style: { height: "100%", width: `${p.progress}%`, background: "linear-gradient(to right, #ff8b9b, #fd8b00)" } }),
              ),
              h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 6 } },
                h("span", { style: { fontFamily: "Inter", fontSize: 10, color: "#adaaaa" } }, `${p.progress}%`),
                h("span", { style: { fontFamily: "Inter", fontSize: 10, color: "#767575" } }, `${p.prompts} prompts · ${p.createdAt}`),
              ),
            ),
          ),

          h("div", { style: { marginTop: 14, display: "flex", gap: 6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 } },
            h("span", {
              style: {
                fontFamily: "Manrope", fontWeight: 900, fontSize: 9, color: "#ff8b9b",
                letterSpacing: ".18em", padding: "3px 8px", borderRadius: 9999,
                border: "1px solid rgba(255,139,155,0.25)", background: "rgba(255,139,155,0.08)",
                textTransform: "uppercase",
              },
            }, p.language),
          ),
        );
      }),
    ),
  );
};

const ProjectsMobile = () => {
  const { t, projects, setActiveProject } = useApp();
  const [q, setQ] = useState("");
  const filtered = projects.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.description.toLowerCase().includes(q.toLowerCase())
  );
  return h("div", {
    style: { flex: 1, overflow: "auto", padding: "16px 16px 80px", background: "#0a0a0a", display: "flex", flexDirection: "column", gap: 14 },
  },
    h("div", {},
      h(Eyebrow, { color: "#ff8b9b" }, "LIBRARY"),
      h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 22, color: "#fff", marginTop: 3, letterSpacing: "-0.02em" } }, t.projectsPageTitle),
    ),
    h(Input, { icon: "search", placeholder: t.searchProjectsPlaceholder, value: q, onChange: e => setQ(e.target.value) }),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
      filtered.map(p => {
        const statusColor = { live: "#4ade80", building: "#fd8b00", draft: "#adaaaa" }[p.status];
        return h("button", {
          key: p.id,
          onClick: () => setActiveProject(p),
          style: {
            display: "flex", flexDirection: "column", gap: 10, padding: 14,
            background: "#131313", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, textAlign: "left", cursor: "pointer", color: "#fff",
          },
        },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
            h(GandoMark, { size: 20, variant: "gradient" }),
            h("span", {
              style: {
                fontSize: 9, fontWeight: 800, color: statusColor, fontFamily: "Manrope",
                textTransform: "uppercase", letterSpacing: ".15em",
              },
            }, p.status),
          ),
          h("div", {
            style: {
              fontFamily: p.language === "Fulani" ? "'Noto Sans Adlam', Manrope" : "Manrope",
              fontWeight: 900, fontSize: 15, color: "#fff", letterSpacing: "-0.01em",
            },
          }, p.name),
          h("div", { style: { fontSize: 11, color: "#adaaaa", lineHeight: 1.4 } }, p.description),
          h("div", { style: { height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 9999, overflow: "hidden" } },
            h("div", { style: { height: "100%", width: `${p.progress}%`, background: "linear-gradient(to right, #ff8b9b, #fd8b00)" } }),
          ),
        );
      }),
    ),
  );
};

Object.assign(window, { ProjectsDesktop, ProjectsMobile });
