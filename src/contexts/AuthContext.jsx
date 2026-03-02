import { createContext, useContext, useState, useEffect } from 'react'
import { auth, onAuthStateChanged, db, isFirebaseConfigured, getTwitterRedirectResult } from '../firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const AuthContext = createContext(null)

// デモ用ユーザーデータ（Firebase未設定時に使用）
const DEMO_USER_DATA = {
    id: 'demo-user',
    displayName: 'デモユーザー',
    authProvider: 'twitter',
    authId: 'demo-user',
    createdAt: new Date()
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Firebase が未設定の場合、ログイン画面を表示する（デモモードではない）
        if (!isFirebaseConfigured || !auth) {
            setLoading(false)
            return
        }

        // リダイレクト認証の結果を処理（signInWithRedirect 使用時）
        getTwitterRedirectResult()
            .then((result) => {
                if (result?.user) {
                    console.info('リダイレクト認証成功:', result.user.displayName)
                }
            })
            .catch((error) => {
                // リダイレクト結果がない場合は正常（エラーではない）
                if (error.code !== 'auth/null-user') {
                    console.warn('リダイレクト認証結果の取得に失敗:', error.code || error.message)
                }
            })

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser)
                try {
                    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
                    if (userDoc.exists()) {
                        setUserData({ id: userDoc.id, ...userDoc.data() })
                    } else {
                        const newUserData = {
                            displayName: firebaseUser.displayName || 'ユーザー',
                            authProvider: firebaseUser.providerData[0]?.providerId === 'twitter.com' ? 'twitter' : 'discord',
                            authId: firebaseUser.uid,
                            createdAt: serverTimestamp()
                        }
                        await setDoc(doc(db, 'users', firebaseUser.uid), newUserData)
                        setUserData({ id: firebaseUser.uid, ...newUserData })
                    }
                } catch (error) {
                    console.error('ユーザーデータの取得に失敗:', error)
                }
            } else {
                setUser(null)
                setUserData(null)
            }
            setLoading(false)
        })

        return () => unsubscribe()
    }, [])

    const value = {
        user,
        userData,
        setUserData,
        loading,
        isFirebaseConfigured
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
