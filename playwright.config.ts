import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  outputDir: 'artifacts/playwright',
  use: {
    baseURL: 'http://localhost:5188',
    viewport: { width: 1920, height: 1080 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } }],
  webServer: { command: 'npx vite --port 5188 --strictPort', url: 'http://localhost:5188', reuseExistingServer: true, timeout: 60_000 },
})
