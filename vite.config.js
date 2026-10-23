import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Prebundle the lazy Excel reader so a first upload cannot trigger a dev reload.
  optimizeDeps: { include: ["exceljs", "jszip"] },
});
