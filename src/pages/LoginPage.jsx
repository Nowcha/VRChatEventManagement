import { useState } from 'react'
import { signInWithTwitter, isFirebaseConfigured } from '../firebase'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleTwitterLogin = async () => {
        setLoading(true)
        setError('')
        try {
            await signInWithTwitter()
            navigate('/dashboard')
        } catch (err) {
            console.error('ログインエラー:', err)
            setError('ログインに失敗しました。もう一度お試しください。')
        } finally {
            setLoading(false)
        }
    }

    const handleDiscordLogin = async () => {
        // Discord OAuth は Firebase のカスタム認証で実装が必要
        // 現時点では未実装の旨を表示
        setError('Discord ログインは現在準備中です。X (Twitter) をご利用ください。')
    }

    return (
        <div className="login-page">
            <div className="login-card slide-up">
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✦</div>
                <h1 className="login-title">Event Manager</h1>
                <p className="login-subtitle">VRChatイベント内部管理システム</p>

                {error && (
                    <div style={{
                        background: 'rgba(214, 48, 49, 0.1)',
                        border: '1px solid rgba(214, 48, 49, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 16px',
                        marginBottom: '24px',
                        color: '#ff6b6b',
                        fontSize: '0.85rem'
                    }}>
                        {error}
                    </div>
                )}

                <button
                    className="btn-oauth btn-oauth-x"
                    onClick={handleTwitterLogin}
                    disabled={loading}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    {loading ? 'ログイン中...' : 'X (Twitter) でログイン'}
                </button>

                <button
                    className="btn-oauth btn-oauth-discord"
                    onClick={handleDiscordLogin}
                    disabled={loading}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    Discord でログイン
                </button>

                <div className="login-divider">
                    <span>内部管理システム</span>
                </div>

                {!isFirebaseConfigured && (
                    <div style={{
                        background: 'rgba(240, 165, 0, 0.1)',
                        border: '1px solid rgba(240, 165, 0, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        textAlign: 'left'
                    }}>
                        <p style={{ color: '#ffd166', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 500 }}>
                            ⚠ Firebase 未設定
                        </p>
                        <p style={{ color: 'rgba(240, 238, 246, 0.45)', fontSize: '0.75rem', lineHeight: '1.6' }}>
                            .env ファイルを作成し、Firebase の設定値を入力してください。
                            テンプレートは .env.example を参照してください。
                        </p>
                    </div>
                )}

                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    招待URLをお持ちの方のみご利用いただけます
                </p>
            </div>
        </div>
    )
}
