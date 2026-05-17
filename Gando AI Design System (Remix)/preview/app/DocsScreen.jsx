// DocsScreen.jsx — documentation hub, desktop + mobile.

const { createElement: h, useState } = React;

const DOC_SECTIONS = [
  {
    id: "getting-started",
    icon: "zap",
    title: "Getting Started",
    subtitle: "Your first app in under 5 minutes",
    topics: ["Create your account", "Sign in with Google", "Your first prompt", "Understanding previews"],
  },
  {
    id: "prompting",
    icon: "chat",
    title: "Prompting Guide",
    subtitle: "Speak to Gando in your own language",
    topics: ["Describing features clearly", "Iterating on designs", "Using ADLaM script", "Switching languages mid-build"],
  },
  {
    id: "deploy",
    icon: "cloud",
    title: "Deploy & Share",
    subtitle: "Ship your app to the world",
    topics: ["Custom domains", "Sharing previews", "Version history", "Team collaboration"],
  },
  {
    id: "api",
    icon: "code",
    title: "API & Integrations",
    subtitle: "Extend Gando programmatically",
    topics: ["REST API reference", "Webhooks", "OAuth flow", "Rate limits"],
  },
  {
    id: "languages",
    icon: "globe",
    title: "Supported Languages",
    subtitle: "English, French, ADLaM & more",
    topics: ["ADLaM (𞤘𞤵𞤤𞤢𞤪)", "Hausa", "Yoruba", "Wolof", "Kiswahili"],
  },
  {
    id: "billing",
    icon: "activity",
    title: "Billing & Tokens",
    subtitle: "How usage and pricing work",
    topics: ["Token costs", "Plan comparison", "Upgrading your plan", "Usage dashboards"],
  },
];

const QUICK_LINKS = [
  { label: "System Status",   href: "#status",   icon: "activity" },
  { label: "Release Notes",   href: "#release",  icon: "book" },
  { label: "Community Forum", href: "#forum",    icon: "users" },
  { label: "Contact Support", href: "#support",  icon: "chat" },
];

// ── DESKTOP ──────────────────────────────────────────────
const DocsDesktop = () => {
  const { t } = useApp();
  const [active, setActive] = useState(DOC_SECTIONS[0].id);
  const section = DOC_SECTIONS.find(s => s.id === active);

  return h("div", { style: { display: "flex", flexDirection: "column", gap: 22 } },
    // header
    h("div", {},
      h(Eyebrow, { color: "#ff8b9b" }, "DOCUMENTATION"),
      h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 36, letterSpacing: "-0.035em", color: "#fff", marginTop: 6, lineHeight: 1 } }, t.docsPageTitle),
      h("p", { style: { fontFamily: "Inter", fontSize: 13, color: "#adaaaa", marginTop: 8, maxWidth: 560 } }, t.docsPageSubtitle),
    ),

    // hero search
    h(Card, {
      style: {
        padding: 28,
        background: "linear-gradient(135deg, rgba(255,139,155,0.1), rgba(253,139,0,0.06) 60%, rgba(19,19,19,1))",
        border: "1px solid rgba(255,139,155,0.2)",
        display: "flex", flexDirection: "column", gap: 14,
      },
    },
      h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 24, color: "#fff", letterSpacing: "-0.03em" } },
        "What do you want to learn?"),
      h(Input, { icon: "search", placeholder: "Search docs — prompting, deploy, ADLaM…", style: { fontSize: 14 } }),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        ["Getting Started", "Prompting Guide", "Deploy", "API Reference", "ADLaM support"].map(tag =>
          h("span", {
            key: tag,
            style: {
              padding: "5px 12px", borderRadius: 9999,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#adaaaa", fontFamily: "Inter", fontSize: 11, fontWeight: 600,
              cursor: "pointer",
            },
          }, tag),
        ),
      ),
    ),

    // browsers
    h("div", { style: { display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 } },
      // sidebar
      h("aside", { style: { display: "flex", flexDirection: "column", gap: 2 } },
        h(Eyebrow, { style: { marginBottom: 10, paddingLeft: 12 } }, "BROWSE"),
        DOC_SECTIONS.map(s =>
          h("button", {
            key: s.id,
            onClick: () => setActive(s.id),
            style: {
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10,
              background: active === s.id ? "rgba(255,139,155,0.12)" : "transparent",
              border: `1px solid ${active === s.id ? "rgba(255,139,155,0.25)" : "transparent"}`,
              color: active === s.id ? "#fff" : "#adaaaa", cursor: "pointer",
              fontFamily: "Inter", fontSize: 12, fontWeight: active === s.id ? 700 : 500,
              textAlign: "left",
            },
          },
            h(Icon, { name: s.icon, size: 14, style: { color: active === s.id ? "#ff8b9b" : "currentColor", flex: "0 0 14px" } }),
            h("span", {}, s.title),
          ),
        ),
        h("div", { style: { marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)" } },
          h(Eyebrow, { style: { marginBottom: 10, paddingLeft: 12 } }, "QUICK LINKS"),
          QUICK_LINKS.map(q =>
            h("a", {
              key: q.label, href: q.href,
              style: {
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 12px", color: "#adaaaa", textDecoration: "none",
                fontFamily: "Inter", fontSize: 11, fontWeight: 500,
              },
            },
              h(Icon, { name: q.icon, size: 11 }),
              q.label,
              h("span", { style: { marginLeft: "auto", color: "#767575" } }, "→"),
            ),
          ),
        ),
      ),

      // content
      h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
        h(Card, { gradientBar: true, style: { padding: 24 } },
          h("div", { style: { display: "flex", gap: 14, alignItems: "center" } },
            h("div", {
              style: {
                width: 48, height: 48, borderRadius: 14,
                background: "rgba(255,139,155,0.1)", border: "1px solid rgba(255,139,155,0.25)",
                display: "grid", placeItems: "center",
              },
            }, h(Icon, { name: section.icon, size: 22, style: { color: "#ff8b9b" } })),
            h("div", { style: { flex: 1 } },
              h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 22, color: "#fff", letterSpacing: "-0.02em" } }, section.title),
              h("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#adaaaa", marginTop: 4 } }, section.subtitle),
            ),
          ),
          h("div", { style: { marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
            section.topics.map((topic, i) =>
              h("a", {
                key: topic, href: `#${section.id}-${i}`,
                style: {
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                  color: "#fff", textDecoration: "none",
                  fontFamily: "Inter", fontSize: 12, fontWeight: 600,
                },
              },
                h("span", {
                  style: {
                    width: 22, height: 22, borderRadius: 7, flex: "0 0 22px",
                    background: "rgba(255,139,155,0.1)", border: "1px solid rgba(255,139,155,0.2)",
                    display: "grid", placeItems: "center",
                    fontFamily: "Manrope", fontWeight: 900, fontSize: 10, color: "#ff8b9b",
                  },
                }, String(i + 1).padStart(2, "0")),
                h("span", { style: { flex: 1 } }, topic),
                h("span", { style: { color: "#767575" } }, "→"),
              ),
            ),
          ),
        ),

        // a sample article preview
        h(Card, { style: { padding: 24 } },
          h(Eyebrow, {}, "ARTICLE · 3 MIN READ"),
          h("h2", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 20, color: "#fff", marginTop: 8, letterSpacing: "-0.02em" } },
            "Writing effective prompts"),
          h("p", { style: { fontFamily: "Inter", fontSize: 13, color: "#adaaaa", lineHeight: 1.6, marginTop: 10 } },
            "Gando understands intent better when you describe who the app is for, what it should do, and the feeling you want it to evoke. Short prompts work — but specificity unlocks better output. Here are three patterns we've seen work best."),
          h("ol", {
            style: {
              marginTop: 14, paddingLeft: 22,
              fontFamily: "Inter", fontSize: 12, color: "#e5e5e5", lineHeight: 1.8,
            },
          },
            h("li", {}, h("b", { style: { color: "#fff" } }, "Audience first."), " Start with who will use the app: \"For Hausa-speaking small-shop owners in Kano…\""),
            h("li", {}, h("b", { style: { color: "#fff" } }, "Describe feeling."), " \"Warm and trustworthy\" beats \"nice design\"."),
            h("li", {}, h("b", { style: { color: "#fff" } }, "One feature per turn."), " Add a feature, review the preview, then iterate."),
          ),
          h("div", { style: { marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
              h(Avatar, { kind: "user", size: 26, label: "K" }),
              h("div", {},
                h("div", { style: { fontFamily: "Manrope", fontWeight: 700, fontSize: 11, color: "#fff" } }, "Kendra Okonkwo"),
                h("div", { style: { fontFamily: "Inter", fontSize: 10, color: "#767575" } }, "Product · Updated 2 days ago"),
              ),
            ),
            h(Button, { variant: "ghost", size: "sm", icon: "arrow-right" }, "Read full article"),
          ),
        ),
      ),
    ),
  );
};

// ── MOBILE ──────────────────────────────────────────────
const DocsMobile = () => {
  const { t } = useApp();
  return h("div", { style: { flex: 1, overflow: "auto", padding: "16px 16px 80px", background: "#0a0a0a", display: "flex", flexDirection: "column", gap: 14 } },
    h("div", {},
      h(Eyebrow, { color: "#ff8b9b" }, "DOCUMENTATION"),
      h("div", { style: { fontFamily: "Manrope", fontWeight: 900, fontSize: 22, color: "#fff", marginTop: 4, letterSpacing: "-0.02em" } }, t.docsPageTitle),
    ),
    h(Input, { icon: "search", placeholder: "Search docs…" }),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
      DOC_SECTIONS.map(s =>
        h("div", {
          key: s.id,
          style: { padding: 14, background: "#131313", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, display: "flex", gap: 12, alignItems: "center" },
        },
          h("div", {
            style: {
              width: 36, height: 36, flex: "0 0 36px", borderRadius: 10,
              background: "rgba(255,139,155,0.1)", border: "1px solid rgba(255,139,155,0.2)",
              display: "grid", placeItems: "center",
            },
          }, h(Icon, { name: s.icon, size: 16, style: { color: "#ff8b9b" } })),
          h("div", { style: { flex: 1 } },
            h("div", { style: { fontFamily: "Manrope", fontWeight: 800, fontSize: 13, color: "#fff" } }, s.title),
            h("div", { style: { fontFamily: "Inter", fontSize: 11, color: "#adaaaa", marginTop: 2 } }, s.subtitle),
          ),
          h("span", { style: { color: "#767575", fontSize: 16 } }, "→"),
        ),
      ),
    ),
  );
};

Object.assign(window, { DocsDesktop, DocsMobile });
