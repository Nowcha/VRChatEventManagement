import { defineConfig, devices } from '@playwright/test'

const PORT = 5174
// `localhost` (not 127.0.0.1): Vite binds to whatever localhost resolves to,
// which is ::1 first on Windows, and the readiness probe must match.
const BASE_URL = `http://localhost:${PORT}/VRChatEventManagement/`

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['github'], ['list']] : [['list']],

    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],

    // `--mode e2e` activates the Firebase mocks declared in vite.config.js.
    webServer: {
        command: `npx vite --mode e2e --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
})
