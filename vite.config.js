import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const mockPath = (name) =>
  fileURLToPath(new URL(`./e2e/mocks/${name}.js`, import.meta.url))

export default defineConfig(({ mode }) => {
  // `vite --mode e2e` swaps Firebase for in-memory mocks so Playwright can
  // render every protected page with fixture data. Production builds are
  // untouched: this branch never runs for `npm run build`.
  const isE2E = mode === 'e2e'

  return {
    base: '/VRChatEventManagement/',
    plugins: [react()],
    resolve: {
      alias: isE2E
        ? {
          'firebase/app': mockPath('firebase-app'),
          'firebase/auth': mockPath('firebase-auth'),
          'firebase/firestore': mockPath('firebase-firestore'),
          'firebase/storage': mockPath('firebase-storage'),
        }
        : {},
    },
    // AuthContext bails out early unless this looks configured.
    define: isE2E
      ? { 'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify('e2e-mock-key') }
      : {},
    server: {
      port: 5173,
      open: true
    }
  }
})
