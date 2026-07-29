/**
 * Stand-in for `firebase/auth` in the `e2e` Vite mode: always signed in as the
 * fixture user, so protected routes render without a real auth round-trip.
 */
import { TEST_UID, users } from './fixtures'

const testUser = {
    uid: TEST_UID,
    displayName: users[0].displayName,
    providerData: [{ providerId: 'twitter.com' }],
}

export function getAuth() {
    return { currentUser: testUser }
}

export function onAuthStateChanged(_auth, callback) {
    // Async to mirror the real listener, which never fires synchronously.
    const t = setTimeout(() => callback(testUser), 0)
    return () => clearTimeout(t)
}

export class TwitterAuthProvider {}

export const signInWithPopup = async () => ({ user: testUser })
export const signInWithRedirect = async () => undefined
export const getRedirectResult = async () => null
export const signOut = async () => undefined
export const deleteUser = async () => undefined
