// WorkspaceScreen.jsx — the core "build an app" experience.
// Desktop: split view (chat on left, preview on right).
// Mobile: tabbed view (chat OR preview, toggleable).

const { createElement: h, useState, useRef, useEffect } = React;

// ── chat panel ─────────────────────────────────────────────
const ChatThread = ({ project }) => {
  const { t } = useApp();
  return h("div", { style: { display: "flex", flexDirection: "column", gap: 14, padding: "16px 20px" } },
    // user prompt
    h("div", { style: { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "flex-end" } },
      h("div", {
        style: {
          maxWidth: "80%", padding: "10px 14px", borderRadius: "14px 14px 4px 14px",
          background: "linear-gradient(135deg, rgba(255,139,155,0.14), rgba(253,139,0,0.08))",
          border: "1px solid rgba(255,139,155,0.25)",
          fontFamily: project.language === "Fulani" ? "'Noto Sans Adlam', Inter" : "Inter",
          fontSize: 13, lineHeight: 1.6, color: "#fff",
        },
      }, project.language === "Fulani"
        ? "𞤘𞤢𞤲𞤣𞤮, 𞤥𞤢𞤸𞤵 𞤢𞤨𞥆 𞤶𞤢𞤲𞤺𞤵𞤺𞤮 𞤆𞤵𞤤𞤢𞤪 𞤣𞤮 𞤧𞤫𞤳𞤮𞥅."
        : `Build me ${project.description.toLowerCase()}. Use warm colors.`),
      h(Avatar, { kind: "user", size: 28, label: "A" }),
    ),
    // bot reply
    h("div", { style: { display: "flex", gap: 12, alignItems: "flex-start" } },
      h(Avatar, { kind: "bot", size: 28 }),
      h("div", { style: { maxWidth: "80%", display: "flex", flexDirection: "column", gap: 8 } },
        h("div", {
          style: {
            padding: "10px 14px", borderRadius: "14px 14px 14px 4px",
            background: "#131313", border: "1px solid rgba(255,255,255,0.06)",
            fontFamily: "Inter", fontSize: 13, lineHeight: 1.6, color: "#e5e5e5",
          },
        }, "Got it. I'm scaffolding your app with a warm palette — terracotta, amber, and deep charcoal. Setting up routing, the home page, and a product listing now."),
        h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
          ["🎨 Palette set", "🗂 Routes generated", "📦 Components linked"].map(chip =>
            h("span", {
              key: chip,
              style: {
                padding: "3px 9px", borderRadius: 9999,
                background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
                color: "#4ade80", fontFamily: "Inter", fontSize: 10, fontWeight: 600,
              },
            }, chip),
          ),
        ),
      ),
    ),
    // follow-up user
    h("div", { style: { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "flex-end" } },
      h("div", {
        style: {
          maxWidth: "80%", padding: "10px 14px", borderRadius: "14px 14px 4px 14px",
          background: "linear-gradient(135deg, rgba(255,139,155,0.14), rgba(253,139,0,0.08))",
          border: "1px solid rgba(255,139,155,0.25)",
          fontFamily: "Inter", fontSize: 13, lineHeight: 1.6, color: "#fff",
        },
      }, "Add a cart button to the product card."),
      h(Avatar, { kind: "user", size: 28, label: "A" }),
    ),
    // generating state
    h("div", { style: { display: "flex", gap: 12, alignItems: "flex-start" } },
      h(Avatar, { kind: "bot", size: 28 }),
      h("div", {
        style: {
          padding: "10px 14px", borderRadius: "14px 14px 14px 4px",
          background: "#131313", border: "1px solid rgba(255,139,155,0.2)",
          display: "flex", alignItems: "center", gap: 10,
        },
      },
        h("div", { style: { display: "flex", gap: 3 } },
          [0, 1, 2].map(i =>
            h("span", {
              key: i,
              style: {
                width: 6, height: 6, borderRadius: 9999,
                background: "#ff8b9b",
                animation: `pulse 1.2s infinite ${i * 0.15}s`,
              },
            }),
          ),
        ),
        h("span", { style: { fontFamily: "Inter", fontSize: 12, color: "#adaaaa" } }, t.generating),
      ),
    ),
    h("style", {}, `@keyframes pulse { 0%,80%,100% { opacity: 0.3 } 40% { opacity: 1 } }`),
  );
};

const ChatComposer = ({ compact = false }) => {
  const { t } = useApp();
  return h("div", {
    style: {
      padding: compact ? "10px 12px" : "12px 16px",
      borderTop: "1px solid rgba(255,255,255,0.05)",
      background: "rgba(10,10,10,0.7)",
      display: "flex", flexDirection: "column", gap: 8,
    },
  },
    h("div", {
      style: {
        display: "flex", alignItems: "center", gap: 8,
        padding: compact ? "8px 10px" : "10px 14px",
        borderRadius: 14,
        background: "#131313", border: "1.5px solid rgba(255,139,155,0.2)",
        boxShadow: "0 0 0 3px rgba(255,139,155,0.04)",
      },
    },
      h(Icon, { name: "chat", size: 14, style: { color: "#ff8b9b" } }),
      h("input", {
        type: "text", placeholder: t.inputPlaceholder,
        style: {
          flex: 1, background: "transparent", border: "none", outline: "none",
          color: "#fff", fontFamily: "Inter", fontSize: 13,
        },
      }),
      h("button", {
        style: {
          width: 32, height: 32, borderRadius: 10, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #ff8b9b, #fd8b00)",
          color: "#0a0a0a", display: "grid", placeItems: "center",
        },
      }, h(Icon, { name: "arrow-right", size: 14 })),
    ),
  );
};

// ── preview panel ──────────────────────────────────────────
const AppPreview = ({ project }) => {
  // fake in-app preview: mocked landing page for the generated app
  const isFulani = project.language === "Fulani";
  const fonts = isFulani ? "'Noto Sans Adlam', Manrope" : "Manrope";

  return h("div", {
    style: {
      flex: 1, minHeight: 0, overflow: "auto",
      background: "linear-gradient(180deg, #2a1810 0%, #1a0f08 100%)",
      padding: 32, display: "flex", flexDirection: "column", gap: 24,
      position: "relative",
    },
  },
    // top bar of the generated app
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      h("div", { style: { fontFamily: fonts, fontWeight: 900, fontSize: 20, color: "#fff", letterSpacing: "-0.02em" } }, project.name),
      h("div", { style: { display: "flex", gap: 16, alignItems: "center" } },
        ["Shop", "About", "Contact"].map(item =>
          h("span", { key: item, style: { fontFamily: "Inter", fontSize: 11, color: "#d4a574" } }, isFulani ? "𞤖𞤮𞤤𞥆𞤭𞤪𞤣𞤫" : item),
        ),
        h("div", {
          style: {
            padding: "6px 14px", borderRadius: 9999,
            background: "linear-gradient(135deg, #d97757, #b85450)",
            color: "#fff", fontFamily: "Inter", fontWeight: 700, fontSize: 11,
          },
        }, isFulani ? "𞤔𞤮𞤳𞥆𞤵" : "Sign in"),
      ),
    ),
    // hero
    h("div", { style: { padding: "28px 0" } },
      h("div", { style: { fontFamily: fonts, fontWeight: 900, fontSize: 36, color: "#fff", letterSpacing: "-0.035em", lineHeight: 1.05, maxWidth: 500 } },
        isFulani ? "𞤔𞤢𞤲𞤺𞤵𞤺𞤮 𞤆𞤵𞤤𞤢𞤪 𞤯𞤵𞤥." : "Handcrafted goods from the heart of Africa."),
      h("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#d4a574", marginTop: 10, maxWidth: 400 } },
        project.description),
      h("div", { style: { display: "flex", gap: 8, marginTop: 16 } },
        h("div", {
          style: {
            padding: "9px 18px", borderRadius: 10,
            background: "linear-gradient(135deg, #d97757, #b85450)",
            color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 11,
          },
        }, isFulani ? "𞤖𞤮𞤤𞥆𞤭" : "Shop now"),
        h("div", {
          style: {
            padding: "9px 18px", borderRadius: 10,
            border: "1px solid rgba(212,165,116,0.4)",
            color: "#d4a574", fontFamily: "Manrope", fontWeight: 700, fontSize: 11,
          },
        }, isFulani ? "𞤖𞤫𞤯𞥆𞤵" : "Learn more"),
      ),
    ),
    // product grid
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 } },
      [
        { name: "Woven Basket",    price: "₦ 12,500", emoji: "🧺" },
        { name: "Mudcloth Throw",  price: "₦ 24,000", emoji: "🪡" },
        { name: "Bronze Figurine", price: "₦ 38,500", emoji: "🗿" },
      ].map(p =>
        h("div", {
          key: p.name,
          style: {
            padding: 12, borderRadius: 14,
            background: "rgba(42,24,16,0.6)", border: "1px solid rgba(212,165,116,0.2)",
            backdropFilter: "blur(10px)",
          },
        },
          h("div", {
            style: {
              aspectRatio: "1/1", borderRadius: 10, marginBottom: 10,
              background: "linear-gradient(135deg, #3d2817, #5c3a1f)",
              display: "grid", placeItems: "center", fontSize: 36,
            },
          }, p.emoji),
          h("div", { style: { fontFamily: "Manrope", fontWeight: 800, fontSize: 12, color: "#fff" } }, p.name),
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 } },
            h("span", { style: { fontFamily: "Inter", fontSize: 11, color: "#d4a574" } }, p.price),
            h("button", {
              style: {
                width: 24, height: 24, borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #d97757, #b85450)",
                color: "#fff", fontSize: 11, cursor: "pointer",
              },
            }, "+"),
          ),
        ),
      ),
    ),
  );
};

const PreviewChrome = ({ children, project }) => {
  const { t } = useApp();
  const [tab, setTab] = useState("preview");
  return h("div", {
    style: {
      flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
      background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16, overflow: "hidden",
    },
  },
    // preview toolbar
    h("div", {
      style: {
        flex: "0 0 auto", height: 46, padding: "0 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(19,19,19,0.9)",
        display: "flex", alignItems: "center", gap: 10,
      },
    },
      // traffic lights
      h("div", { style: { display: "flex", gap: 6 } },
        ["#ff5f57", "#febc2e", "#28c840"].map(c =>
          h("span", { key: c, style: { width: 11, height: 11, borderRadius: 9999, background: c } })
        ),
      ),
      // tabs
      h("div", {
        style: {
          display: "flex", padding: 3, gap: 2,
          borderRadius: 9, background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)", marginLeft: 10,
        },
      },
        ["preview", "code"].map(key =>
          h("button", {
            key,
            onClick: () => setTab(key),
            style: {
              padding: "4px 11px", borderRadius: 7, border: "none", cursor: "pointer",
              background: tab === key ? "rgba(255,139,155,0.14)" : "transparent",
              color: tab === key ? "#fff" : "#adaaaa",
              fontFamily: "Manrope", fontWeight: 700, fontSize: 10,
              letterSpacing: ".06em", textTransform: "uppercase",
            },
          }, t[key]),
        ),
      ),
      // url bar
      h("div", {
        style: {
          flex: 1, height: 28, borderRadius: 8, marginLeft: 6,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", padding: "0 10px", gap: 8,
          fontFamily: "Inter", fontSize: 10, color: "#adaaaa",
        },
      },
        h(Icon, { name: "activity", size: 10, style: { color: "#4ade80" } }),
        h("span", {}, `${project.id}.gando.app`),
      ),
      // actions
      h("div", { style: { display: "flex", gap: 5 } },
        h(Button, { variant: "ghost", size: "sm", icon: "share" }, t.share),
        h(Button, { variant: "primary", size: "sm", icon: "plus" }, t.deploy),
      ),
    ),
    // content
    tab === "preview"
      ? h(AppPreview, { project })
      : h("div", {
          style: {
            flex: 1, background: "#0a0a0a",
            fontFamily: "'IBM Plex Mono', 'SF Mono', monospace", fontSize: 11,
            padding: 16, color: "#d4d4d4", overflow: "auto", lineHeight: 1.7,
          },
        },
          h("div", { style: { color: "#767575" } }, "// App.jsx"),
          h("div", {},
            h("span", { style: { color: "#ff8b9b" } }, "export default "),
            h("span", { style: { color: "#fd8b00" } }, "function "),
            h("span", { style: { color: "#ffd166" } }, "App"),
            h("span", { style: { color: "#d4d4d4" } }, "() {"),
          ),
          h("div", { style: { paddingLeft: 20 } },
            h("span", { style: { color: "#ff8b9b" } }, "return "),
            h("span", { style: { color: "#d4d4d4" } }, "("),
          ),
          h("div", { style: { paddingLeft: 40 } },
            h("span", { style: { color: "#4ade80" } }, "<Hero "),
            h("span", { style: { color: "#ffd166" } }, "title"),
            h("span", { style: { color: "#d4d4d4" } }, "="),
            h("span", { style: { color: "#ff8b9b" } }, `"${project.name}"`),
            h("span", { style: { color: "#4ade80" } }, " />"),
          ),
          h("div", { style: { paddingLeft: 40 } },
            h("span", { style: { color: "#4ade80" } }, "<ProductGrid "),
            h("span", { style: { color: "#ffd166" } }, "items"),
            h("span", { style: { color: "#d4d4d4" } }, "={items} "),
            h("span", { style: { color: "#4ade80" } }, "/>"),
          ),
          h("div", { style: { paddingLeft: 20 } },
            h("span", { style: { color: "#d4d4d4" } }, ");"),
          ),
          h("div", {}, "}"),
        ),
  );
};

// ── DESKTOP WORKSPACE ──────────────────────────────────────
const WorkspaceDesktop = () => {
  const { activeProject, t, workspaceLayout } = useApp();
  if (!activeProject) return null;
  const isSplit = workspaceLayout === "split";

  return h("div", { style: { display: "flex", flexDirection: "column", gap: 14, height: "100%" } },
    // breadcrumb + header
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 } },
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, fontFamily: "Inter", fontSize: 11, color: "#767575" } },
          h("span", { style: { color: "#ff8b9b", fontWeight: 700 } }, t.projectsNav),
          h("span", {}, "›"),
          h("span", { style: { color: "#fff" } }, activeProject.name),
        ),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
          h("div", {
            style: {
              fontFamily: activeProject.language === "Fulani" ? "'Noto Sans Adlam', Manrope" : "Manrope",
              fontWeight: 900, fontSize: 26, color: "#fff", letterSpacing: "-0.03em",
            },
          }, activeProject.name),
          h("span", {
            style: {
              fontFamily: "Manrope", fontWeight: 900, fontSize: 9, color: "#4ade80",
              padding: "3px 8px", borderRadius: 9999,
              border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)",
              letterSpacing: ".16em", textTransform: "uppercase",
              display: "inline-flex", alignItems: "center", gap: 5,
            },
          },
            h("span", { style: { width: 5, height: 5, borderRadius: 9999, background: "#4ade80" } }),
            activeProject.status,
          ),
          h("span", {
            style: {
              fontFamily: "Inter", fontSize: 10, color: "#adaaaa",
              padding: "3px 8px", borderRadius: 9999,
              background: "rgba(255,139,155,0.08)", border: "1px solid rgba(255,139,155,0.2)",
            },
          }, activeProject.language),
        ),
      ),
      h("div", { style: { display: "flex", gap: 6 } },
        h(Button, { variant: "ghost", size: "md", icon: "download" }, t.download),
        h(Button, { variant: "ghost", size: "md", icon: "share" }, t.share),
        h(Button, { variant: "primary", size: "md", icon: "plus" }, t.deploy),
      ),
    ),

    // workspace body
    h("div", {
      style: {
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateColumns: isSplit ? "380px 1fr" : "1fr",
        gap: 14,
      },
    },
      // chat side
      isSplit && h("div", {
        style: {
          display: "flex", flexDirection: "column",
          background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16, overflow: "hidden",
        },
      },
        h("div", {
          style: {
            flex: "0 0 auto", padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 10,
          },
        },
          h(GandoMark, { size: 16, variant: "gradient" }),
          h("span", { style: { fontFamily: "Manrope", fontWeight: 800, fontSize: 12, color: "#fff" } }, "Chat with Gando"),
          h("span", {
            style: {
              marginLeft: "auto", fontFamily: "Manrope", fontWeight: 700, fontSize: 9,
              color: "#adaaaa", letterSpacing: ".12em", textTransform: "uppercase",
            },
          }, `${activeProject.prompts} prompts`),
        ),
        h("div", { style: { flex: 1, minHeight: 0, overflow: "auto" } }, h(ChatThread, { project: activeProject })),
        h(ChatComposer),
      ),
      // preview side
      h(PreviewChrome, { project: activeProject }),
    ),
  );
};

// ── MOBILE WORKSPACE ─────────────────────────────────────
const WorkspaceMobile = () => {
  const { activeProject, t } = useApp();
  const [tab, setTab] = useState("preview");
  if (!activeProject) return null;
  return h("div", { style: { flex: 1, display: "flex", flexDirection: "column", background: "#0a0a0a", minHeight: 0 } },
    // header
    h("div", { style: { padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 8 } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 8, fontFamily: "Inter", fontSize: 10, color: "#767575" } },
        h("span", { style: { color: "#ff8b9b" } }, t.projectsNav),
        h("span", {}, "›"),
        h("span", { style: { color: "#fff" } }, activeProject.name),
      ),
      h("div", {
        style: {
          fontFamily: activeProject.language === "Fulani" ? "'Noto Sans Adlam', Manrope" : "Manrope",
          fontWeight: 900, fontSize: 18, color: "#fff", letterSpacing: "-0.02em",
        },
      }, activeProject.name),
      // tab switch
      h("div", {
        style: {
          display: "flex", padding: 3, borderRadius: 10,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        },
      },
        ["preview", "chat"].map(k =>
          h("button", {
            key: k,
            onClick: () => setTab(k),
            style: {
              flex: 1, padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer",
              background: tab === k ? "linear-gradient(135deg, rgba(255,139,155,0.16), rgba(253,139,0,0.1))" : "transparent",
              color: tab === k ? "#fff" : "#adaaaa",
              fontFamily: "Manrope", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em",
            },
          }, k),
        ),
      ),
    ),
    // body
    h("div", { style: { flex: 1, minHeight: 0, overflow: "auto" } },
      tab === "preview" ? h(AppPreview, { project: activeProject }) : h(ChatThread, { project: activeProject }),
    ),
    tab === "chat" ? h(ChatComposer, { compact: true }) : null,
  );
};

Object.assign(window, { WorkspaceDesktop, WorkspaceMobile });
