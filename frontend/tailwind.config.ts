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
        border: "#E2E8F0",
        input: "#E2E8F0",
        ring: "#1E3A8A",
        background: "#F8FAFC",
        foreground: "#0F172A",
        muted: {
          DEFAULT: "#F1F5F9",
          foreground: "#64748B",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#0F172A",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
