import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Los grises y los tintes de estado (50/100/200/300) salen de variables CSS que
// define app/theme.css (generado por scripts/gen-theme.mjs): así todo el panel
// cambia entre claro y oscuro sin tocar cada componente.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const FAMILIES = [
  "red",
  "green",
  "amber",
  "blue",
  "indigo",
  "purple",
  "teal",
  "emerald",
  "orange",
  "yellow",
  "sky",
  "rose",
  "violet",
  "fuchsia",
  "slate",
] as const;
const TINTS = [50, 100, 200, 300] as const;

const palette: Record<string, Record<string, string>> = {
  gray: {
    ...colors.gray,
    ...Object.fromEntries(
      [50, 100, 200, 300, 400, 500, 600, 700, 800].map((s) => [
        s,
        v(`gray-${s}`),
      ]),
    ),
  },
};
for (const f of FAMILIES) {
  const base = colors[f] as unknown as Record<string, string>;
  palette[f] = {
    ...base,
    ...Object.fromEntries(
      TINTS.filter((s) => base[s]).map((s) => [s, v(`${f}-${s}`)]),
    ),
  };
}

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...palette,
        ocupada: "#16a34a",
        reservada: "#2563eb",
        proxima: "#dc2626",
        otros: "rgb(var(--gray-200) / <alpha-value>)",
        accent: {
          DEFAULT: v("accent"),
          fg: v("accent-fg"),
          hover: v("accent-hover"),
        },
        panel: { DEFAULT: v("panel"), 2: v("panel-2") },
        fg: v("fg"),
      },
      boxShadow: {
        card: "var(--shadow-card)",
        btn: "var(--shadow-btn)",
        pop: "var(--shadow-pop)",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "system-ui",
          "sans-serif",
        ],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
