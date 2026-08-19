import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "phaser-full-reload",
      handleHotUpdate({ server }) {
        server.ws.send({ type: "full-reload", path: "*" });
        return [];
      },
    },
  ],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "es2022",
  },
});
