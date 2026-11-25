import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT ?? 5173;
const baseURL = `http://localhost:${port}`;
const serverPort = Number(process.env.E2E_SERVER_PORT ?? 8787);
const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `npm run dev -- --port ${port} --strictPort`,
      url: baseURL,
      env: { VITE_SERVER_URL: `http://localhost:${serverPort}` },
      reuseExistingServer,
    },
    // 서버는 HTTP 404만 주므로 url이 아니라 port로 준비를 기다린다
    { command: 'npm start', port: serverPort, env: { PORT: String(serverPort) }, reuseExistingServer },
  ],
});
