/// <reference types="node" />
import { join } from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(join(process.cwd(), "../../packages/db/migrations"));

  return {
    test: {
      setupFiles: ["./test/setup.ts"],
    },
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          d1Databases: ["DB"],
          bindings: {
            ACCESS_TEAM_DOMAIN: "",
            ACCESS_AUD: "",
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
  };
});
