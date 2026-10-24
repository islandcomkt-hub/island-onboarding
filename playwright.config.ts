import { defineConfig } from "@playwright/test";

// PLAYWRIGHT_CHROMIUM_PATH (opcional) aponta para um Chromium já instalado.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const port = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    launchOptions: {
      executablePath,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    // O servidor de testes roda em modo produção: o mock precisa ser liberado explicitamente
    env: { ALLOW_MOCK_IN_PRODUCTION: "true" },
    timeout: 60_000,
  },
});
