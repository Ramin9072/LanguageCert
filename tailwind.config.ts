import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f1f2f4",
        ink: "#15171c",
        muted: "#646b78",
        line: "#e0e3e9",
        accent: { DEFAULT: "#3447b8", dark: "#283a9c", soft: "#e8ebfa" },
        good: { DEFAULT: "#23704a", soft: "#e2f3ea" },
        bad: { DEFAULT: "#b23a2c", soft: "#fbe8e4" },
        warn: { DEFAULT: "#9a6a12", soft: "#fbf0d9" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        fa: ["var(--font-fa)", "Tahoma", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(21,23,28,.05), 0 10px 30px -14px rgba(21,23,28,.16)",
      },
    },
  },
  plugins: [],
};

export default config;
