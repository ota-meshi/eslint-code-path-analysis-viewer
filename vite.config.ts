import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import eslint4b from "vite-plugin-eslint4b";
import { fileURLToPath } from "url";
import path from "path";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default defineConfig(() => ({
  plugins: [vue(), eslint4b()],
  resolve: {
    alias: {},
  },
}));
