import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "rgb(var(--tw-brand) / <alpha-value>)",
        secondary: "rgb(var(--tw-secondary) / <alpha-value>)",
        foreground: "rgb(var(--tw-foreground) / <alpha-value>)",
        background: "rgb(var(--tw-background) / <alpha-value>)",
        surface: "rgb(var(--tw-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--tw-surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--tw-surface-3) / <alpha-value>)",
        divider: "rgb(var(--tw-divider) / <alpha-value>)",
        border: "rgb(var(--tw-border) / <alpha-value>)",
        muted: "rgb(var(--tw-muted) / <alpha-value>)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/container-queries"),
  ],
};

export default config;
