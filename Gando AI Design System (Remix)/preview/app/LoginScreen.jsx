// LoginScreen.jsx — the public hero + Google sign-in.
// Used in BOTH the desktop frame and the phone frame. Mobile is centered + narrower.

const { createElement: h } = React;

const AmbientGlows = ({ scale = 1 }) =>
  h(React.Fragment, {},
    h(GlowOrb, { color: "#ff8b9b", size: 520 * scale, x: "18%", y: "22%", opacity: 0.22, blur: 140 }),
    h(GlowOrb, { color: "#fd8b00", size: 560 * scale, x: "82%", y: "82%", opacity: 0.18, blur: 160 }),
    h(GlowOrb, { color: "#bca2ff", size: 380 * scale, x: "78%", y: "18%", opacity: 0.10, blur: 140 }),
  );

const GoogleG = ({ size = 18 }) =>
  h("svg", { width: size, height: size, viewBox: "0 0 48 48", style: { flex: "0 0 auto" } },
    h("path", { fill: "#EA4335", d: "M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.3 2.1 30 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.6 17.6 9.5 24 9.5z" }),
    h("path", { fill: "#4285F4", d: "M46.5 24.5c0-1.6-.2-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.5z" }),
    h("path", { fill: "#FBBC05", d: "M10.4 28.7c-.5-1.4-.7-3-.7-4.7s.3-3.3.7-4.7l-7.8-6.1C.9 16.3 0 20 0 24s.9 7.7 2.6 10.8l7.8-6.1z" }),
    h("path", { fill: "#34A853", d: "M24 48c6 0 11.1-2 14.8-5.4l-7.6-5.9c-2.1 1.4-4.8 2.3-7.2 2.3-6.4 0-11.8-4.1-13.6-10l-7.8 6.1C6.5 42.6 14.6 48 24 48z" }),
  );

// Desktop variant (fills a browser window) ────────────────
const LoginScreenDesktop = () => {
  const { t, lang } = useApp();
  const isAdlam = lang === "ff-adlm";
  const fontFam = isAdlam ? "'Noto Sans Adlam', Manrope" : "Manrope";

  return h("div", {
    style: {
      height: "100%", width: "100%", position: "relative", overflow: "hidden",
      background: "#0a0a0a",
    },
  },
    h(AmbientGlows, {}),
    h("div", {
      style: {
        position: "relative", zIndex: 2, height: "100%",
        display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 0,
      },
    },
      // LEFT: hero
      h("div", {
        style: {
          padding: "60px 72px", display: "flex", flexDirection: "column",
          justifyContent: "space-between",
        },
      },
        // top: wordmark + beta chip
        h("div", { style: { display: "flex", alignItems: "center", gap: 14 } },
          h(Wordmark, { size: 36 }),
          h("span", {
            style: {
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 11px 5px 8px", borderRadius: 9999,
              background: "rgba(255,139,155,0.1)", border: "1px solid rgba(255,139,155,0.25)",
              color: "#ff8b9b", fontFamily: "Manrope", fontWeight: 900,
              fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase",
            },
          },
            h(GandoMark, { size: 12, variant: "gradient" }),
            t.beta,
          ),
        ),

        // middle: hero copy
        h("div", { style: { paddingTop: 60 } },
          h("div", {
            style: {
              fontFamily: "Manrope", fontWeight: 900, fontSize: 11,
              letterSpacing: ".3em", color: "#ff8b9b", textTransform: "uppercase",
              marginBottom: 18,
            },
          }, "GANDO · BUILT FOR AFRICA"),
          h("h1", {
            style: {
              fontFamily: fontFam, fontWeight: 900, fontSize: 72,
              lineHeight: 0.96, letterSpacing: "-0.04em",
              color: "#fff", margin: 0, maxWidth: 620, textWrap: "balance",
            },
          },
            isAdlam
              ? h("span", {}, t.heroTitle)
              : h(React.Fragment, {},
                  "Build apps in your",
                  h("br"),
                  h("span", {
                    style: {
                      background: "linear-gradient(135deg,#ff8b9b,#fd8b00)",
                      WebkitBackgroundClip: "text", backgroundClip: "text",
                      WebkitTextFillColor: "transparent", color: "transparent",
                    },
                  }, "native tongue."),
                ),
          ),
          h("p", {
            style: {
              fontFamily: "Inter", fontSize: 17, lineHeight: 1.55,
              color: "#adaaaa", marginTop: 26, maxWidth: 480, textWrap: "pretty",
            },
          }, t.heroSubtitle),
        ),

        // bottom: cta + secondary info
        h("div", {},
          h("button", {
            style: {
              display: "inline-flex", alignItems: "center", gap: 12,
              height: 60, padding: "0 28px", borderRadius: 16,
              background: "#fff", color: "#0a0a0a", border: "none",
              fontFamily: "Manrope", fontWeight: 800, fontSize: 15,
              cursor: "pointer", letterSpacing: "-.01em",
              boxShadow: "0 24px 60px -10px rgba(255,139,155,0.4)",
            },
          },
            h(GoogleG, { size: 20 }),
            t.loginWithGoogle,
          ),
          h("div", {
            style: {
              display: "flex", gap: 28, marginTop: 28,
              fontFamily: "Inter", fontSize: 12, color: "#767575",
            },
          },
            h("span", {}, "🔒 SOC 2 Type II"),
            h("span", {}, "•"),
            h("span", {}, "Data stays in-region"),
            h("span", {}, "•"),
            h("span", {}, "Free during Beta"),
          ),
        ),
      ),

      // RIGHT: visual showcase — a floating product preview card
      h("div", {
        style: {
          position: "relative", overflow: "hidden",
          borderLeft: "1px solid rgba(255,255,255,0.05)",
        },
      },
        // bigger glow
        h("div", {
          style: {
            position: "absolute", width: 500, height: 500,
            right: -100, top: "50%", transform: "translateY(-50%)",
            background: "radial-gradient(circle, rgba(255,139,155,0.25), transparent 60%)",
            pointerEvents: "none",
          },
        }),
        // floating mark with arc
        h("div", {
          style: {
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          },
        },
          // three stacked project preview cards, tilted
          h("div", { style: { position: "relative", width: 360, height: 420, perspective: 1200 } },
            [
              { rot: -10, offset: -30, bg: "linear-gradient(135deg,#4c1d95,#0f172a)", name: "Owambe Events", lang: "YORUBA", progress: 92 },
              { rot: -2,  offset: 0,   bg: "linear-gradient(135deg,#1e1b4b,#0e0e0e)", name: "𞤔𞤢𞤲𞤺𞤵𞤺𞤮 𞤆𞤵𞤤𞤢𞤪",   lang: "FULANI · ADLAM", progress: 78 },
              { rot: 6,   offset: 30,  bg: "linear-gradient(135deg,#7c2d12,#0e0e0e)", name: "Marché Bamako",     lang: "FRANÇAIS", progress: 100 },
            ].map((card, i) => h("div", {
              key: i,
              style: {
                position: "absolute",
                inset: 0,
                transform: `translate(${card.offset}px, ${card.offset * 0.8}px) rotate(${card.rot}deg)`,
                borderRadius: 22,
                background: card.bg,
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 30px 60px -10px rgba(0,0,0,0.6)",
                padding: 22,
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                zIndex: i,
              },
            },
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
                h(GandoMark, { size: 24, variant: "gradient" }),
                h("span", {
                  style: {
                    fontFamily: "Manrope", fontWeight: 900, fontSize: 9,
                    letterSpacing: ".18em", color: "#ff8b9b",
                    padding: "3px 8px", borderRadius: 9999,
                    border: "1px solid rgba(255,139,155,0.3)",
                    background: "rgba(255,139,155,0.1)",
                  },
                }, card.lang),
              ),
              h("div", {},
                h("div", {
                  style: {
                    fontFamily: card.lang.includes("ADLAM") ? "'Noto Sans Adlam', Manrope" : "Manrope",
                    fontWeight: 900, fontSize: 22, color: "#fff",
                    letterSpacing: "-.02em",
                  },
                }, card.name),
                h("div", { style: { marginTop: 14, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 9999, overflow: "hidden" } },
                  h("div", { style: { height: "100%", width: `${card.progress}%`, background: "linear-gradient(to right, #ff8b9b, #fd8b00)" } }),
                ),
                h("div", { style: { marginTop: 8, fontFamily: "Inter", fontSize: 11, color: "#adaaaa" } }, `${card.progress}% built`),
              ),
            )),
          ),
        ),
      ),
    ),
  );
};

// Mobile variant (fills a phone) ──────────────────────────
const LoginScreenMobile = () => {
  const { t, lang } = useApp();
  const isAdlam = lang === "ff-adlm";
  const fontFam = isAdlam ? "'Noto Sans Adlam', Manrope" : "Manrope";

  return h("div", {
    style: {
      flex: 1, position: "relative", overflow: "hidden", background: "#0a0a0a",
      display: "flex", flexDirection: "column", padding: "24px 28px 36px",
    },
  },
    h(AmbientGlows, { scale: 0.6 }),
    h("div", {
      style: {
        position: "relative", zIndex: 2, display: "flex", flexDirection: "column",
        flex: 1, justifyContent: "space-between",
      },
    },
      // top: mark + beta
      h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
        h(Wordmark, { size: 26 }),
        h("span", {
          style: {
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 8px 3px 6px", borderRadius: 9999,
            background: "rgba(255,139,155,0.1)", border: "1px solid rgba(255,139,155,0.25)",
            color: "#ff8b9b", fontFamily: "Manrope", fontWeight: 900,
            fontSize: 8, letterSpacing: ".18em", textTransform: "uppercase",
          },
        },
          h(GandoMark, { size: 9, variant: "gradient" }),
          "BETA",
        ),
      ),

      // middle: hero
      h("div", {},
        h("div", {
          style: {
            fontFamily: "Manrope", fontWeight: 900, fontSize: 9,
            letterSpacing: ".3em", color: "#ff8b9b", textTransform: "uppercase",
            marginBottom: 14,
          },
        }, "BUILT FOR AFRICA"),
        h("h1", {
          style: {
            fontFamily: fontFam, fontWeight: 900, fontSize: 40,
            lineHeight: 0.98, letterSpacing: "-0.04em",
            color: "#fff", margin: 0, textWrap: "balance",
          },
        },
          isAdlam
            ? t.heroTitle
            : h(React.Fragment, {},
                "Build apps in your ",
                h("span", {
                  style: {
                    background: "linear-gradient(135deg,#ff8b9b,#fd8b00)",
                    WebkitBackgroundClip: "text", backgroundClip: "text",
                    WebkitTextFillColor: "transparent", color: "transparent",
                  },
                }, "native tongue."),
              ),
        ),
        h("p", {
          style: {
            fontFamily: "Inter", fontSize: 13, lineHeight: 1.55,
            color: "#adaaaa", marginTop: 16, textWrap: "pretty",
          },
        }, t.heroSubtitle),
      ),

      // bottom: CTA stack
      h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
        h("button", {
          style: {
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
            height: 56, borderRadius: 16,
            background: "#fff", color: "#0a0a0a", border: "none",
            fontFamily: "Manrope", fontWeight: 800, fontSize: 14,
            cursor: "pointer", letterSpacing: "-.01em",
            boxShadow: "0 16px 40px -8px rgba(255,139,155,0.35)",
          },
        },
          h(GoogleG, { size: 18 }),
          t.loginWithGoogle,
        ),
        h("div", {
          style: {
            textAlign: "center",
            fontFamily: "Inter", fontSize: 10, color: "#767575",
          },
        }, "🔒 SOC 2 · Free during Beta"),
      ),
    ),
  );
};

Object.assign(window, { LoginScreenDesktop, LoginScreenMobile });
