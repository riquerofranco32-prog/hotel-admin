// Genera app/theme.css: la paleta del panel en claro y oscuro.
//
// Idea (la misma que usa el admin de Se7en): los componentes siguen escribiendo
// clases de Tailwind (bg-white, text-gray-500, bg-green-50…) y el tema cambia
// solo, porque esos colores salen de variables CSS (ver tailwind.config.ts).
// Lo que no se puede resolver con una variable (texto de estado, bg-white,
// bg-gray-900…) se cubre con reglas `.dark …` que este script genera mirando
// las clases que de verdad se usan en el código.
//
//   node scripts/gen-theme.mjs           escribe app/theme.css
//   node scripts/gen-theme.mjs --check   falla si está desactualizado
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const colors = require("tailwindcss/colors");
const OUT = "app/theme.css";
const ROOTS = ["app", "components", "lib"];

/* ── paleta ─────────────────────────────────────────────────────────────── */
export const NEUTRAL_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800];
// Gris oscuro con un dejo de azul mar (el hotel es "Al Mare").
const DARK_GRAY = {
  50: "#101820", 100: "#151e28", 200: "#1e2a37", 300: "#2c3b4b", 400: "#6a7a8e",
  500: "#8c9aac", 600: "#a6b2c1", 700: "#c2ccd8", 800: "#dde4ed",
};
const DARK_PANEL = "#0e151c"; // color de las tarjetas, para mezclar los tintes
export const FAMILIES = ["red", "green", "amber", "blue", "indigo", "purple", "teal", "emerald", "orange", "yellow", "sky", "rose", "violet", "fuchsia", "slate"];
const TINT_SHADES = { 50: 0.1, 100: 0.17, 200: 0.28, 300: 0.42 }; // fondos y bordes: tinte sobre la tarjeta
// Texto de estado: en oscuro se usa un tono más claro de la misma familia.
const TEXT_DARK = { 500: 400, 600: 400, 700: 300, 800: 200, 900: 100 };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => hex(a).map((v, i) => Math.round(v * t + hex(b)[i] * (1 - t)));
const trip = (rgb) => rgb.join(" ");

const light = [];
const dark = [];
for (const s of NEUTRAL_SHADES) {
  light.push(`--gray-${s}: ${trip(hex(colors.gray[s]))};`);
  dark.push(`--gray-${s}: ${trip(hex(DARK_GRAY[s]))};`);
}
for (const f of FAMILIES) {
  for (const [s, t] of Object.entries(TINT_SHADES)) {
    if (!colors[f][s]) continue;
    light.push(`--${f}-${s}: ${trip(hex(colors[f][s]))};`);
    dark.push(`--${f}-${s}: ${trip(mix(colors[f][500], DARK_PANEL, t))};`);
  }
}

/* ── reglas por clase usada ─────────────────────────────────────────────── */
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx|ts)$/.test(name)) files.push(path);
  }
};
ROOTS.forEach(walk);
const src = files.map((f) => readFileSync(f, "utf8")).join("\n");

const famRe = FAMILIES.join("|");
const TOKEN = new RegExp(
  String.raw`(?<![\w:/-])(?:(?:hover|group-hover|focus):)?(?:text-(?:${famRe})-(?:500|600|700|800|900)|text-gray-900|bg-gray-900(?!\/)|bg-white(?:\/\d+)?|border-white(?:\/\d+)?|ring-black\/5|bg-gray-900\/\d+)(?![\w/-])`,
  "g",
);
const tokens = new Set([...src.matchAll(TOKEN)].map((m) => m[0]));

const esc = (s) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
function rule(token) {
  const m = /^(?:(hover|group-hover|focus):)?(.*)$/.exec(token);
  const variant = m[1];
  const body = m[2];
  let sel = `.dark .${esc(token)}`;
  if (variant === "hover" || variant === "focus") sel += `:${variant}`;
  if (variant === "group-hover") sel = `.dark .group:hover .${esc(token)}`;
  let decl;
  let x;
  if ((x = new RegExp(`^text-(${famRe})-(\\d+)$`).exec(body))) decl = `color: rgb(${trip(hex(colors[x[1]][TEXT_DARK[x[2]]]))})`;
  else if (body === "text-gray-900") decl = "color: rgb(var(--fg))";
  else if (body === "bg-gray-900") decl = "background-color: rgb(var(--strong))";
  else if ((x = /^bg-gray-900\/(\d+)$/.exec(body))) decl = `background-color: rgba(2, 6, 10, ${Math.min(0.8, Number(x[1]) / 100 + 0.25)})`;
  else if ((x = /^bg-white(?:\/(\d+))?$/.exec(body))) decl = `background-color: rgb(var(--panel) / ${x[1] ? Number(x[1]) / 100 : 1})`;
  else if ((x = /^border-white(?:\/(\d+))?$/.exec(body))) decl = `border-color: rgb(var(--gray-200) / ${x[1] ? Number(x[1]) / 100 : 1})`;
  else if (body === "ring-black/5") decl = "--tw-ring-color: rgba(255, 255, 255, 0.08)";
  return `${sel} { ${decl}; }`;
}

const css = [
  "/* GENERADO por scripts/gen-theme.mjs: no editar a mano. */",
  ":root {",
  ...light.map((l) => `  ${l}`),
  "}",
  ".dark {",
  ...dark.map((l) => `  ${l}`),
  "}",
  "/* El botón o chip \"sólido\" (bg-gray-900) pasa a ser claro en oscuro: el texto blanco se invierte. */",
  ".dark .bg-gray-900.text-white { color: rgb(var(--strong-fg)); }",
  ...[...tokens].sort().map(rule),
  "",
].join("\n");

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8").replace(/\r\n/g, "\n");
  } catch {}
  if (current !== css) {
    console.error(`${OUT} está desactualizado: correr node scripts/gen-theme.mjs`);
    process.exit(1);
  }
  console.log(`${OUT} al día (${tokens.size} clases)`);
} else {
  writeFileSync(OUT, css);
  console.log(`${OUT}: ${tokens.size} clases`);
}
