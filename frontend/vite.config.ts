import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api to the FastAPI backend so the frontend can use same-origin paths.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on IPv4 + IPv6 so 127.0.0.1 and localhost both work
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});
