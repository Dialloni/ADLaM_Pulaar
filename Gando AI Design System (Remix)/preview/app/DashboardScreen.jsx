// DashboardScreen.jsx — the logged-in home for both desktop and mobile.

const { createElement: h, useState } = React;

// ── Small building blocks ─────────────────────────────────
const StatCard = ({ label, value, delta, deltaPositive = true, gradient }) =>
  h("div", {
    style: {
      flex: 1, minWidth: 0, padding: 20, borderRadius: 18,
      background: gradient
        ? "linear-gradient(135deg, rgba(255,139,155,0.12), rgba(253,139,0,0.06))"
        : "#131313",
      border: `1px solid ${gradient ? "rgba(255,139,155,0.25)" : "rgba(255,255,255,0.08)"}`,
      position: "relative", overflow: "hidden",
    },
  },
    h(Eyebrow, { color: gradient ? "#ff8b9b" : "#767575" }, label),
    h("div", {
      style: {
        fontFamily: "Manrope", fontWeight: 900, fontSize: 36,
        letterSpacing: "-0.03em", color: "#fff", marginTop: 10, lineHeight: 1,
      },
    }, value),
    delta && h("div", {
      style: {
        marginTop: 10, display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
        background: deltaPositive ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
        color: deltaPositive ? "#4ade80" : "#f87171",
        fontFamily: "Inter",
      },
    }, deltaPositive ? "↗" : "↘", " ", delta),
  );

const ProjectRow = ({ p, onClick }) => {
  const statusColor = { live: "#4ade80", building: "#fd8b00", draft: "#adaaaa" }[p.status];
  return h("button", {
    onClick,
    style: {
      width: "100%", display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", borderRadius: 14,
      background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
      color: "#fff", cursor: "pointer", textAlign: "left",
      transition: "all 180ms", fontFamily: "Inter",
    },
    onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.03)",
    onMouseLeave: e => e.currentTarget.style.background = "transparent",
  },
    h("div", {
      style: {
        width: 40, height: 40, borderRadius: 12,
        background: "rgba(255,139,155,0.1)",
        border: "1px solid rgba(255,139,155,0.2)",
        display: "grid", placeItems: "center", flex: "0 0 auto",
      },
    }, h(GandoMark, { size: 20, variant: "gradient" })),
    h("div", { style: { flex: 1, minWidth: 0 } },
      h("div", {
        style: {
          fontFamily: p.language === "Fulani" ? "'Noto Sans Adlam', Manrope" : "Manrope",
          fontWeight: 800, fontSize: 14, color: "#fff", letterSpacing: "-0.01em",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        },
      }, p.name),
      h("div", {
        style: {
          fontSize: 11, color: "#adaaaa", marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        },
      }, p.language, " · ", p.description),
    ),
    h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: "0 0 auto" } },
      h("span", {
        style: {
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 10, fontWeight: 700, color: statusColor,
          textTransform: "uppercase", letterSpacing: ".15em", fontFamily: "Manrope",
        },
      },
        h("span", { style: { width: 6, height: 6, borderRadius: 9999, background: statusColor } }),
        p.status,
      ),
      h("span", { style: { fontSize: 10, color: "#767575" } }, p.createdAt),
    ),
  );
};

// ── DESKTOP dashboard ────────────────────────────────────
const DashboardDesktop = () => {
  const { t, projects, dashboardVariant, setActiveProject, setRoute } = useApp();
  const liveCount = projects.filter(p => p.status === "live").length;
  const totalPrompts = projects.reduce((a, b) => a + b.prompts, 0);

  // Shared "hero + chat" block — the empty-state prompt/welcome
  const hero = h("div", {
    style: {
      padding: "28px 32px", borderRadius: 22,
      background: "linear-gradient(135deg, rgba(255,139,155,0.08), rgba(253,139,0,0.04))",
      border: "1px solid rgba(255,139,155,0.2)",
      position: "relative", overflow: "hidden",
    },
  },
    h(GlowOrb, { color: "#ff8b9b", size: 400, x: "0%", y: "100%", opacity: 0.15, blur: 100 }),
    h("div", { style: { position: "relative", zIndex: 1 } },
      h(Eyebrow, { color: "#ff8b9b" }, "OVERVIEW"),
      h("h1", {
        style: {
          fontFamily: "Manrope", fontWeight: 900, fontSize: 38,
          letterSpacing: "-0.035em", color: "#fff", margin: "6px 0 0", lineHeight: 1.05,
        },
      }, t.gandoViewTitle),
      h("p", { style: { fontFamily: "Inter", fontSize: 14, color: "#adaaaa", marginTop: 8 } }, t.gandoViewSubtitle),

      // inline chat starter
      h("div", {
        style: {
          marginTop: 22, display: "flex", alignItems: "center", gap: 10,
          padding: "6px 6px 6px 18px", borderRadius: 16,
          background: "rgba(10,10,10,0.7)", border: "1px solid rgba(255,255,255,0.08)",
          maxWidth: 640,
        },
      },
        h(GandoMark, { size: 18, variant: "gradient" }),
        h("input", {
          placeholder: t.inputPlaceholder,
          style: {
            flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
            color: "#fff", fontFamily: "Inter", fontSize: 14,
          },
        }),
        h(Button, { variant: "primary", size: "md", icon: "send" }, "Generate"),
      ),
      // suggestions
      h("div", { style: { marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" } },
        [t.suggestionEcom, t.suggestionLearning, t.suggestionCommunity].map(s =>
          h(Chip, { key: s, tone: "neutral" }, s),
        ),
      ),
    ),
  );

  return h("div", { style: { display: "flex", flexDirection: "column", gap: 24 } },
    hero,

    // stats strip
    h("div", { style: { display: "flex", gap: 14 } },
      h(StatCard, { label: t.projectsLabel,       value: projects.length, delta: "+2 this week", gradient: true }),
      h(StatCard, { label: t.appsBuiltLabel,      value: liveCount,        delta: "+1" }),
      h(StatCard, { label: t.totalPromptsLabel,   value: totalPrompts,     delta: "+12" }),
      h(StatCard, { label: t.tokenUsageLabel,     value: "42%",            delta: t.healthyLabel, deltaPositive: true }),
    ),

    // projects block — two variants
    dashboardVariant === "cards"
      ? h("div", {},
          h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 } },
            h("div", {},
              h(Eyebrow, {}, t.activeSiteBuildsLabel),
              h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 22, color: "#fff", marginTop: 4 } }, t.projectCompletionLabel),
            ),
            h("button", {
              onClick: () => setRoute("projects"),
              style: {
                background: "transparent", border: "none", color: "#ff8b9b",
                fontFamily: "Manrope", fontWeight: 700, fontSize: 12,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              },
            }, t.viewAllLabel, h(Icon, { name: "arrowR", size: 12 })),
          ),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 } },
            projects.slice(0, 6).map(p =>
              h(Card, {
                key: p.id, gradientBar: true,
                onClick: () => { setActiveProject(p); setRoute("workspace"); },
                style: { padding: 18 },
              },
                h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
                  h(GandoMark, { size: 24, variant: "gradient" }),
                  h("span", {
                    style: {
                      fontFamily: "Manrope", fontWeight: 900, fontSize: 9, color: "#ff8b9b",
                      letterSpacing: ".18em", padding: "3px 8px", borderRadius: 9999,
                      border: "1px solid rgba(255,139,155,0.25)", background: "rgba(255,139,155,0.08)",
                      textTransform: "uppercase",
                    },
                  }, p.language),
                ),
                h("div", {
                  style: {
                    fontFamily: p.language === "Fulani" ? "'Noto Sans Adlam', Manrope" : "Manrope",
                    fontWeight: 900, fontSize: 18, color: "#fff",
                    marginTop: 18, letterSpacing: "-0.02em", lineHeight: 1.15,
                  },
                }, p.name),
                h("div", { style: { fontFamily: "Inter", fontSize: 11, color: "#767575", marginTop: 6, lineHeight: 1.45 } }, p.description),
                h("div", { style: { marginTop: 16, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 9999, overflow: "hidden" } },
                  h("div", { style: { height: "100%", width: `${p.progress}%`, background: "linear-gradient(to right, #ff8b9b, #fd8b00)" } }),
                ),
                h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 8 } },
                  h("span", { style: { fontFamily: "Inter", fontSize: 10, color: "#adaaaa" } }, `${p.progress}% built`),
                  h("span", { style: { fontFamily: "Inter", fontSize: 10, color: "#767575" } }, p.createdAt),
                ),
              ),
            ),
          ),
        )
      : h("div", {},
          h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 } },
            h("div", {},
              h(Eyebrow, {}, t.activeSiteBuildsLabel),
              h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 22, color: "#fff", marginTop: 4 } }, t.projectsPageTitle),
            ),
            h("button", {
              onClick: () => setRoute("projects"),
              style: {
                background: "transparent", border: "none", color: "#ff8b9b",
                fontFamily: "Manrope", fontWeight: 700, fontSize: 12,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              },
            }, t.viewAllLabel, h(Icon, { name: "arrowR", size: 12 })),
          ),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
            projects.map(p => h(ProjectRow, { key: p.id, p, onClick: () => { setActiveProject(p); setRoute("workspace"); } })),
          ),
        ),
  );
};

// ── MOBILE dashboard ─────────────────────────────────────
const DashboardMobile = () => {
  const { t, projects, setActiveProject, setRoute } = useApp();
  const liveCount = projects.filter(p => p.status === "live").length;

  return h("div", {
    style: {
      flex: 1, overflow: "auto", padding: "18px 18px 80px",
      background: "#0a0a0a", display: "flex", flexDirection: "column", gap: 16,
    },
  },
    // header row
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      h("div", {},
        h(Eyebrow, { color: "#ff8b9b" }, "OVERVIEW"),
        h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 22, color: "#fff", marginTop: 3, letterSpacing: "-0.02em" } }, t.gandoViewTitle),
      ),
      h(Avatar, { kind: "user", size: 36, label: "A" }),
    ),

    // quick prompt card
    h("div", {
      style: {
        padding: 16, borderRadius: 18,
        background: "linear-gradient(135deg, rgba(255,139,155,0.12), rgba(253,139,0,0.06))",
        border: "1px solid rgba(255,139,155,0.25)",
        position: "relative", overflow: "hidden",
      },
    },
      h(Eyebrow, { color: "#ff8b9b" }, t.newProject.toUpperCase()),
      h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 16, color: "#fff", marginTop: 4 } }, t.chatWelcome),
      h("div", {
        style: {
          marginTop: 12, display: "flex", alignItems: "center", gap: 8,
          padding: "4px 4px 4px 12px", borderRadius: 12,
          background: "rgba(10,10,10,0.7)", border: "1px solid rgba(255,255,255,0.08)",
        },
      },
        h(GandoMark, { size: 14, variant: "gradient" }),
        h("div", { style: { flex: 1, color: "#767575", fontSize: 12, fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, t.inputPlaceholder),
        h("button", {
          style: {
            width: 32, height: 32, borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#ff8b9b,#fd8b00)", color: "#0a0a0a",
            display: "grid", placeItems: "center", cursor: "pointer",
          },
        }, h(Icon, { name: "send", size: 14 })),
      ),
    ),

    // stats row (2 cols)
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
      h(StatCard, { label: t.projectsLabel, value: projects.length, delta: "+2", gradient: true }),
      h(StatCard, { label: t.appsBuiltLabel, value: liveCount, delta: t.healthyLabel }),
    ),

    // recent projects
    h("div", {},
      h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 } },
        h(Eyebrow, {}, t.activeSiteBuildsLabel),
        h("button", {
          onClick: () => setRoute("projects"),
          style: {
            background: "transparent", border: "none", color: "#ff8b9b",
            fontFamily: "Manrope", fontWeight: 700, fontSize: 11,
            cursor: "pointer",
          },
        }, t.viewAllLabel, " →"),
      ),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
        projects.slice(0, 4).map(p => h(ProjectRow, { key: p.id, p, onClick: () => { setActiveProject(p); setRoute("workspace"); } })),
      ),
    ),
  );
};

Object.assign(window, { DashboardDesktop, DashboardMobile });
