import { defineConfig } from "vite"

export default defineConfig({
  build: {
    rollupOptions: { input: { game: "index.html", artSample: "art-sample.html" } },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:5174" },
  },
})
