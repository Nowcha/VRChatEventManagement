import { initializeApp } from 'firebase/app'
import {
    getAuth,
    TwitterAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged
} from 'firebase/auth'
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

/**
 * X (Twitter) ログイン
 * signInWithPopup を試行し、失敗した場合は signInWithRedirect にフォールバック
 * （サードパーティCookieブロック等への対策）
 */
export const signInWithTwitter = async () => {
    if (!isFirebaseConfigured) {
        throw new Error('Firebase が未設定です。.env ファイルを設定してください。')
    }
    try {
        // まず Popup 方式を試行
        const result = await signInWithPopup(auth, twitterProvider)
        return result
    } catch (error) {
        // Popup がブロックされた場合、または Cookie 関連のエラーの場合はリダイレクト方式にフォールバック
        const fallbackErrors = [
            'auth/popup-blocked',
            'auth/popup-closed-by-user',
            'auth/cancelled-popup-request',
            'auth/web-storage-unsupported',
            'auth/invalid-credential',
            'auth/operation-not-allowed',
        ]
        if (fallbackErrors.includes(error.code) || error.message?.includes('request is invalid')) {
            console.warn('Popup 認証失敗、リダイレクト方式にフォールバック:', error.code || error.message)
            return signInWithRedirect(auth, twitterProvider)
        }
        throw error
    }
}

/**
 * リダイレクト認証の結果を取得
 * ページ読み込み時に呼び出して、リダイレクト方式でのログイン結果を処理する
 */
export const getTwitterRedirectResult = () => {
    if (!auth) return Promise.resolve(null)
    return getRedirectResult(auth)
}

export const logOut = () => {
    if (auth) return signOut(auth)
    return Promise.resolve()
}

export { onAuthStateChanged }
