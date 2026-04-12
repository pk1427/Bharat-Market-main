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
        ink: "#08111f",
        panel: "#0e1a2f",
        line: "#203452",
        gold: "#f4c95d",
        mint: "#5ff2bf",
        coral: "#ff7d5c"
      },
      boxShadow: {
        pulse: "0 20px 50px rgba(8, 17, 31, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;
