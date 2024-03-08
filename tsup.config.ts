import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli/cli.ts"],
  splitting: false,
  sourcemap: true,
  clean: true,
  format: ["cjs"], // 👈 Node
});
