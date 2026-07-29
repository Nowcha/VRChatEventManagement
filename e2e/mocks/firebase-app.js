/** Stand-in for `firebase/app` in the `e2e` Vite mode. */
export function initializeApp() {
    return { __app: true }
}
