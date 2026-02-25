import { initializeApp } from 'firebase/app'
import { getAuth, TwitterAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000'
}

// Firebase が未設定かどうかを判定
export const isFirebaseConfigured = !!(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-key'
)

let app, auth, db, storage

try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
    storage = getStorage(app)
} catch (error) {
    console.warn('Firebase の初期化に失敗しました:', error.message)
    console.info('Firebase Console で設定値を取得し、.env ファイルを作成してください。')
}

export { auth, db, storage }

// Auth Providers
const twitterProvider = new TwitterAuthProvider()

export const signInWithTwitter = () => {
    if (!isFirebaseConfigured) {
        return Promise.reject(new Error('Firebase が未設定です。.env ファイルを設定してください。'))
    }
    return signInWithPopup(auth, twitterProvider)
}

export const logOut = () => {
    if (auth) return signOut(auth)
    return Promise.resolve()
}

export { onAuthStateChanged }
