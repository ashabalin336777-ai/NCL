import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1E3A8A",
          50: "#EFF4FF",
          100: "#DBE6FE",
          700: "#1D4ED8",
          900: "#1E3A8A",
        },
        accent: {
          DEFAULT: "#F97316",
          50: "#FFF7ED",
          600: "#EA580C",
        },
        border: "rgb(var(--border) / 0.08)",
        input: "rgb(var(--input) / 0.12)",
        ring: "rgb(var(--ring) / 1)",
        background: "#0B0F19",
        foreground: "rgb(var(--foreground) / 1)",
        muted: {
          DEFAULT: "rgb(var(--muted) / 1)",
          foreground: "rgb(var(--muted-foreground) / 1)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / 0.6)",
          foreground: "rgb(var(--card-foreground) / 1)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / 1)",
          foreground: "rgb(var(--primary-foreground) / 1)",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0, 0, 0, 0.25)",
        "glow-accent": "0 0 15px rgba(249, 115, 22, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
