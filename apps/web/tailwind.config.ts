import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark fantasy palette
        parchment: {
          50: "#fdf8ee",
          100: "#f9edcf",
          200: "#f2d89b",
          300: "#eabd5f",
          400: "#e4a633",
          500: "#d98c1a",
          600: "#c06d12",
          700: "#9f5012",
          800: "#823f15",
          900: "#6c3415",
          950: "#3e1a09",
        },
        gold: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        arcane: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          900: "#2e1065",
        },
        blood: {
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          900: "#450a0a",
        },
        void: {
          800: "#0f0a1a",
          900: "#08050f",
          950: "#030208",
        },
        stone: {
          750: "#2a2a35",
          800: "#1e1e28",
          850: "#16161e",
          900: "#0d0d14",
        },
      },
      fontFamily: {
        cinzel: ["var(--font-cinzel)", "serif"],
        lora: ["var(--font-lora)", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "dungeon-texture": "url('/images/textures/dungeon.jpg')",
        "parchment-texture": "url('/images/textures/parchment.jpg')",
        "hero-gradient":
          "radial-gradient(ellipse at center, rgba(139,92,246,0.15) 0%, rgba(8,5,15,1) 70%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(30,30,40,0.9) 0%, rgba(15,10,26,0.95) 100%)",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
        "rune-spin": "spin 8s linear infinite",
        "flicker": "flicker 3s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
          "25%, 75%": { opacity: "0.95" },
        },
      },
      boxShadow: {
        arcane: "0 0 20px rgba(139,92,246,0.4), 0 0 40px rgba(139,92,246,0.1)",
        gold: "0 0 20px rgba(251,191,36,0.4), 0 0 40px rgba(251,191,36,0.1)",
        "inner-glow": "inset 0 0 20px rgba(139,92,246,0.15)",
      },
    },
  },
  plugins: [typography],
};

export default config;
