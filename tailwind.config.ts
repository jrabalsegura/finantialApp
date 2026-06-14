import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        muted: "#5f6b76",
        surface: "#f7f7f4",
        line: "#dedbd2",
        accent: "#1f7a6b"
      }
    }
  },
  plugins: []
};

export default config;
