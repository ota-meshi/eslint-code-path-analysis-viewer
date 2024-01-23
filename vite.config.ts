import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import eslint4b from "vite-plugin-eslint4b";

export default defineConfig(() => ({
  base: "/eslint-code-path-analysis-viewer/",
  plugins: [vue(), eslint4b()],
  resolve: {
    alias: {},
  },
}));
