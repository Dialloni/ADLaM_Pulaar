// Primitive UI elements — buttons, chips, inputs, cards.
const { createElement: h, useState } = React;

const cx = (...xs) => xs.filter(Boolean).join(" ");

// ─── BUTTON ───────────────────────────────────────────────
const Button = ({ variant = "primary", size = "md", icon, children, onClick, disabled, style, ...rest }) => {
  const [pressed, setPressed] = useState(false);
  const sizes = {
    sm: { padding: "6px 12px", fontSize: 12, height: 30, radius: 10, gap: 6 },
    md: { padding: "10px 18px", fontSize: 13, height: 40, radius: 14, gap: 8 },
    lg: { padding: "14px 24px", fontSize: 14, height: 52, radius: 16, gap: 10 },
  }[size];

  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: sizes.gap, padding: sizes.padding, height: sizes.height,
    fontFamily: "Manrope", fontWeight: 700, fontSize: sizes.fontSize,
    borderRadius: sizes.radius, cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", transition: "all 180ms cubic-bezier(0.16,1,0.3,1)",
    transform: pressed ? "scale(0.97)" : "scale(1)",
    opacity: disabled ? 0.5 : 1, letterSpacing: "-0.01em",
    whiteSpace: "nowrap", userSelect: "none",
  };

  const variants = {
    primary: {
      background: "linear-gradient(135deg,#ff8b9b,#fd8b00)",
      color: "#0a0a0a", boxShadow: "0 0 24px rgba(255,139,155,0.35)",
    },
    ghost: {
      background: "rgba(255,255,255,0.04)", color: "#fff",
      border: "1px solid rgba(255,255,255,0.1)",
    },
    subtle: {
      background: "rgba(255,255,255,0.02)", color: "#adaaaa",
      border: "1px solid rgba(255,255,255,0.06)",
    },
    danger: {
      background: "rgba(248,113,113,0.1)", color: "#f87171",
      border: "1px solid rgba(248,113,113,0.3)",
    },
    icon: {
      background: "rgba(255,255,255,0.04)", color: "#adaaaa",
      border: "1px solid rgba(255,255,255,0.08)",
      padding: 0, width: sizes.height,
    },
  };

  return h("button", {
    ...rest,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    onClick: disabled ? undefined : onClick,
    disabled,
    style: { ...base, ...variants[variant], ...style },
  }, icon && h(Icon, { name: icon, size: size === "lg" ? 18 : 16 }), children);
};

// ─── CHIP / EYEBROW ────────────────────────────────────────
const Eyebrow = ({ children, color = "#767575", style }) =>
  h("span", {
    style: {
      fontFamily: "Manrope", fontWeight: 900, fontSize: 10,
      letterSpacing: "0.2em", textTransform: "uppercase", color, ...style,
    },
  }, children);

const Chip = ({ children, tone = "neutral", icon, style }) => {
  const tones = {
    neutral:  { bg: "rgba(255,255,255,0.06)", fg: "#adaaaa", bd: "rgba(255,255,255,0.08)" },
    primary:  { bg: "rgba(255,139,155,0.15)", fg: "#ff8b9b", bd: "rgba(255,139,155,0.3)" },
    lavender: { bg: "rgba(188,162,255,0.12)", fg: "#bca2ff", bd: "rgba(188,162,255,0.25)" },
    success:  { bg: "rgba(74,222,128,0.12)", fg: "#4ade80", bd: "rgba(74,222,128,0.3)" },
    warn:     { bg: "rgba(253,139,0,0.12)",  fg: "#fd8b00", bd: "rgba(253,139,0,0.3)" },
    danger:   { bg: "rgba(248,113,113,0.12)", fg: "#f87171", bd: "rgba(248,113,113,0.3)" },
  }[tone];
  return h("span", {
    style: {
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600,
      fontFamily: "Inter", background: tones.bg, color: tones.fg,
      border: `1px solid ${tones.bd}`, ...style,
    },
  }, icon && h(Icon, { name: icon, size: 11 }), children);
};

// ─── STATUS PILL ───────────────────────────────────────────
const StatusPill = ({ status = "operational", label }) => {
  const map = {
    operational: { color: "#4ade80", icon: "check", text: "Operational" },
    degraded:    { color: "#fd8b00", icon: "alert", text: "Degraded" },
    down:        { color: "#f87171", icon: "xcircle", text: "Down" },
    checking:    { color: "#adaaaa", icon: "loader", text: "Checking" },
  }[status];
  return h("span", {
    style: {
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700,
      background: `${map.color}18`, color: map.color,
      border: `1px solid ${map.color}40`, fontFamily: "Inter",
    },
  }, h(Icon, { name: map.icon, size: 11 }), label || map.text);
};

// ─── INPUT ────────────────────────────────────────────────
const Input = ({ icon, placeholder, value, onChange, style, suffix, size = "md", ...rest }) => {
  const [focus, setFocus] = useState(false);
  const sizes = { md: { h: 44, r: 14, fs: 13 }, lg: { h: 56, r: 18, fs: 15 } }[size];
  return h("label", {
    style: {
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 14px", height: sizes.h,
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${focus ? "rgba(255,139,155,0.4)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: sizes.r,
      boxShadow: focus ? "0 0 50px -12px rgba(255,139,155,0.2)" : "none",
      transition: "all 180ms cubic-bezier(0.16,1,0.3,1)", ...style,
    },
  },
    icon && h(Icon, { name: icon, size: 16, style: { color: "#767575", flex: "0 0 auto" } }),
    h("input", {
      ...rest, value, onChange, placeholder,
      onFocus: () => setFocus(true), onBlur: () => setFocus(false),
      style: {
        flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
        color: "#fff", fontFamily: "Inter", fontSize: sizes.fs, fontWeight: 500,
      },
    }),
    suffix,
  );
};

// ─── CARD ─────────────────────────────────────────────────
const Card = ({ children, hover = true, gradientBar = false, style, onClick }) => {
  const [hov, setHov] = useState(false);
  return h("div", {
    onMouseEnter: () => setHov(true), onMouseLeave: () => setHov(false), onClick,
    style: {
      position: "relative", background: "#131313",
      border: `1px solid ${hov && hover ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 20, transition: "all 300ms cubic-bezier(0.16,1,0.3,1)",
      transform: hov && hover ? "translateY(-4px)" : "translateY(0)",
      cursor: onClick ? "pointer" : "default", overflow: "hidden", ...style,
    },
  },
    gradientBar && h("div", {
      style: {
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(to right, #ff8b9b, #fd8b00)",
        opacity: hov ? 1 : 0.6, transition: "opacity 300ms",
      },
    }),
    children,
  );
};

// ─── ICON CHIP (the "colored square with icon" pattern) ───
const IconChip = ({ icon, color = "#ff8b9b", size = 40 }) =>
  h("div", {
    style: {
      width: size, height: size, borderRadius: 12,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: `${color}2e`, color, flex: "0 0 auto",
    },
  }, h(Icon, { name: icon, size: size * 0.5 }));

// ─── AVATAR ───────────────────────────────────────────────
const Avatar = ({ kind = "user", size = 32, label }) => {
  const variants = {
    user:   { bg: "#3b82f6", icon: "user",  color: "#fff" },
    bot:    { bg: "linear-gradient(135deg,#ff8b9b,#fd8b00)", icon: "bot", color: "#0a0a0a" },
    empty:  { bg: "rgba(255,255,255,0.06)", icon: "user", color: "#767575" },
  }[kind];
  return h("div", {
    style: {
      width: size, height: size, borderRadius: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: variants.bg, color: variants.color, flex: "0 0 auto",
      fontFamily: "Manrope", fontWeight: 900, fontSize: size * 0.4,
    },
  }, label ? label.slice(0, 1).toUpperCase() : h(Icon, { name: variants.icon, size: size * 0.5 }));
};

// ─── GLOW ORB (background ambient blob) ───────────────────
const GlowOrb = ({ color = "#ff8b9b", size = 600, x = "50%", y = "50%", opacity = 0.08, blur = 120 }) =>
  h("div", {
    style: {
      position: "absolute", width: size, height: size,
      left: x, top: y, transform: "translate(-50%,-50%)",
      background: color, filter: `blur(${blur}px)`, opacity,
      borderRadius: 9999, pointerEvents: "none",
    },
  });

// ─── GANDO MARK (Ga Hook logomark — abstracted ADLaM 𞤘) ──
// Use this ANYWHERE the product needs a "brand dot" — avatars for the bot,
// loader dots, beta chips, dashboard hero, workspace badge. Never use a 4-point
// sparkle (reads as Gemini).
const GandoMark = ({ size = 24, variant = "gradient", style }) => {
  const fills = {
    gradient: "url(#gando-mark-grad)",
    mono:     "currentColor",
    ink:      "#0a0a0a",
  };
  const stroke = fills[variant] || fills.gradient;
  const uid = "gm-" + size + "-" + variant;
  return h("svg", {
    width: size, height: size, viewBox: "0 0 64 64",
    style: { flex: "0 0 auto", ...style },
    "aria-hidden": "true",
  },
    variant === "gradient" && h("defs", {},
      h("linearGradient", { id: "gando-mark-grad", x1: "0", y1: "0", x2: "1", y2: "1" },
        h("stop", { offset: "0%",  stopColor: "#ff8b9b" }),
        h("stop", { offset: "100%", stopColor: "#fd8b00" }),
      ),
    ),
    // Ga Hook: vertical stem -> arc -> terminus dot
    h("path", {
      d: "M20 14 L20 38 Q20 48 30 48 Q42 48 42 36 Q42 26 32 26 L26 26",
      stroke, strokeWidth: 6, strokeLinecap: "round", strokeLinejoin: "round",
      fill: "none",
    }),
    h("circle", { cx: 32, cy: 18, r: 4, fill: variant === "gradient" ? "#fd8b00" : stroke }),
  );
};

// ─── WORDMARK ─────────────────────────────────────────────
const Wordmark = ({ size = 28, script = "latin" }) => {
  const text = script === "adlam" ? "𞤘𞤢𞤲𞤣𞤮" : "Gando";
  return h("span", {
    style: {
      fontFamily: script === "adlam" ? "Noto Sans Adlam" : "Manrope",
      fontWeight: 900, fontSize: size, letterSpacing: "-0.04em",
      background: "linear-gradient(135deg,#ff8b9b,#fd8b00)",
      WebkitBackgroundClip: "text", backgroundClip: "text",
      WebkitTextFillColor: "transparent", color: "transparent",
      lineHeight: 1,
    },
  }, text);
};

Object.assign(window, { Button, Chip, Eyebrow, StatusPill, Input, Card, IconChip, Avatar, GlowOrb, GandoMark, Wordmark, cx });
