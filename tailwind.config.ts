import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ocupada: "#16a34a",
        reservada: "#2563eb",
        proxima: "#dc2626",
        otros: "#e5e7eb",
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
