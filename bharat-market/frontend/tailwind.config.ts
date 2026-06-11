import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--surface-0)",
        panel: "var(--surface-1)",
        line: "var(--border-subtle)",
        gold: "var(--amber)",
        mint: "var(--green)",
        coral: "var(--red)",
        accent: "var(--accent)",
        blue: "var(--blue)"
      },
      boxShadow: {
        pulse: "0 20px 50px rgba(8, 17, 31, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;
