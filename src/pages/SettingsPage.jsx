import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { deleteUser } from 'firebase/auth'
import { db, auth } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsPage() {
    const { user, userData, setUserData } = useAuth()
    const navigate = useNavigate()
    const [displayName, setDisplayName] = useState(userData?.displayName || '')
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')

    const handleUpdateDisplayName = async (e) => {
        e.preventDefault()
        if (!displayName.trim()) return
        setSaving(true)
        setMessage('')
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                displayName: displayName.trim()
            })
            setUserData(prev => ({ ...prev, displayName: displayName.trim() }))
            setMessage('表示名を更新しました')
        } catch (error) {
            console.error('更新エラー:', error)
            setMessage('更新に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteAccount = async () => {
        if (!window.confirm('本当にアカウントを削除しますか？この操作は取り消せません。')) return
        if (!window.confirm('最終確認: アカウントを完全に削除します。よろしいですか？')) return

        try {
            // Firestoreのユーザードキュメントを削除
            await deleteDoc(doc(db, 'users', user.uid))
            // Firebase Authのユーザーを削除
            await deleteUser(auth.currentUser)
            navigate('/login')
        } catch (error) {
            console.error('アカウント削除エラー:', error)
            setMessage('アカウントの削除に失敗しました。再ログインしてからお試しください。')
        }
    }

    const inviteUrl = 'https://nowcha.github.io/VRChatEventManagement/'

    const copyInviteUrl = () => {
        navigator.clipboard.writeText(inviteUrl).then(() => {
            setMessage('招待URLをコピーしました')
        }).catch(() => {
            setMessage('コピーに失敗しました')
        })
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">設定</h1>
                <p className="page-subtitle">アカウント設定と招待管理</p>
            </div>

            {/* メッセージ表示 */}
            {message && (
                <div className="card mb-lg" style={{
                    borderColor: message.includes('失敗') ? 'rgba(214, 48, 49, 0.3)' : 'rgba(0, 206, 201, 0.3)',
                    padding: '12px 20px'
                }}>
                    <p className="text-sm" style={{
                        color: 'var(--color-dark-gray)'
                    }}>
                        {message}
                    </p>
                </div>
            )}

            {/* プロフィール */}
            <div className="card mb-lg">
                <div className="card-header">
                    <h3 className="card-title">プロフィール</h3>
                </div>
                <form onSubmit={handleUpdateDisplayName}>
                    <div className="form-group">
                        <label className="form-label">表示名</label>
                        <input
                            type="text"
                            className="form-input"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder="任意の表示名を入力"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">認証プロバイダ</label>
                        <p className="text-sm text-muted">
                            {userData?.authProvider === 'twitter' ? 'X (Twitter)' : 'Discord'}
                        </p>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? '保存中...' : '表示名を更新'}
                    </button>
                </form>
            </div>

            {/* 招待URL */}
            <div className="card mb-lg">
                <div className="card-header">
                    <h3 className="card-title">招待URL</h3>
                </div>
                <p className="text-sm text-muted mb-md">
                    以下のURLを共有すると、新しいメンバーがシステムに参加できます。
                </p>
                <div className="flex gap-md items-center">
                    <input
                        type="text"
                        className="form-input"
                        value={inviteUrl}
                        readOnly
                        style={{ flex: 1 }}
                    />
                    <button className="btn btn-secondary" onClick={copyInviteUrl}>
                        コピー
                    </button>
                </div>
            </div>

            {/* アカウント削除 */}
            <div className="card" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="card-header">
                    <h3 className="card-title" style={{ color: 'var(--color-dark-gray)' }}>危険な操作</h3>
                </div>
                <p className="text-sm text-muted mb-lg">
                    アカウントを削除すると、すべてのデータが失われます。この操作は取り消せません。
                </p>
                <button className="btn btn-danger" onClick={handleDeleteAccount}>
                    アカウントを削除
                </button>
            </div>
        </div>
    )
}
