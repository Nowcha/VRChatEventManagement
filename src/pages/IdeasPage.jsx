import { useState, useEffect } from 'react'
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const REACTIONS = ['👍', '❤️', '🎉', '💡', '🔥']

const STATUS_LABELS = {
    unused: { label: '未使用', className: 'badge-unused' },
    used:   { label: '使用済', className: 'badge-used' }
}

export default function IdeasPage() {
    const { user, userData } = useAuth()
    const [ideas, setIdeas] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'unused' | 'used'
    const [titleInput, setTitleInput] = useState('')
    const [descInput, setDescInput] = useState('')
    const [posting, setPosting] = useState(false)
    const [deleteConfirmId, setDeleteConfirmId] = useState(null)

    // Firestoreのリアルタイム購読
    useEffect(() => {
        const q = query(collection(db, 'ideas'), orderBy('createdAt', 'desc'))
        const unsub = onSnapshot(q, (snap) => {
            setIdeas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            setLoading(false)
        }, (error) => {
            console.error('アイデア取得エラー:', error)
            setLoading(false)
        })
        return () => unsub()
    }, [])

    // アイデア投稿
    const handlePost = async (e) => {
        e.preventDefault()
        const trimmed = titleInput.trim()
        if (!trimmed) return

        setPosting(true)
        try {
            await addDoc(collection(db, 'ideas'), {
                title: trimmed,
                description: descInput.trim(),
                authorId: user.uid,
                authorName: userData?.displayName || user.displayName || 'Unknown',
                status: 'unused',
                reactions: Object.fromEntries(REACTIONS.map(r => [r, []])),
                createdAt: serverTimestamp()
            })
            setTitleInput('')
            setDescInput('')
        } catch (error) {
            console.error('投稿エラー:', error)
        } finally {
            setPosting(false)
        }
    }

    // リアクショントグル
    const handleReaction = async (idea, emoji) => {
        const reacted = (idea.reactions?.[emoji] || []).includes(user.uid)
        const fieldPath = `reactions.${emoji}`
        try {
            await updateDoc(doc(db, 'ideas', idea.id), {
                [fieldPath]: reacted ? arrayRemove(user.uid) : arrayUnion(user.uid)
            })
        } catch (error) {
            console.error('リアクションエラー:', error)
        }
    }

    // ステータス切り替え
    const handleToggleStatus = async (idea) => {
        const next = idea.status === 'unused' ? 'used' : 'unused'
        try {
            await updateDoc(doc(db, 'ideas', idea.id), { status: next })
        } catch (error) {
            console.error('ステータス更新エラー:', error)
        }
    }

    // 削除
    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, 'ideas', id))
        } catch (error) {
            console.error('削除エラー:', error)
        } finally {
            setDeleteConfirmId(null)
        }
    }

    const filtered = statusFilter === 'all'
        ? ideas
        : ideas.filter(i => i.status === statusFilter)

    const formatDate = (ts) => {
        if (!ts?.toDate) return ''
        const d = ts.toDate()
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
    }

    return (
        <div className="page-container">
            {/* ヘッダー */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">イベントタイトル アイデア</h1>
                    <p className="page-subtitle">タイトルのアイデアを自由に投稿・共有しましょう</p>
                </div>
            </div>

            {/* 投稿フォーム */}
            <div className="card ideas-post-card">
                <form onSubmit={handlePost}>
                    <div className="form-group" style={{ marginBottom: 'var(--space-sm)' }}>
                        <label className="form-label">アイデアタイトル <span style={{ color: 'var(--accent-pink)' }}>*</span></label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="例：夜想曲 ～月影のソワレ～"
                            value={titleInput}
                            onChange={e => setTitleInput(e.target.value)}
                            maxLength={100}
                            required
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="form-label">補足・メモ（任意）</label>
                        <textarea
                            className="form-input"
                            style={{ resize: 'vertical', minHeight: '64px' }}
                            placeholder="コンセプトや参考など..."
                            value={descInput}
                            onChange={e => setDescInput(e.target.value)}
                            maxLength={300}
                        />
                    </div>
                    <button
                        className="btn btn--primary"
                        type="submit"
                        disabled={posting || !titleInput.trim()}
                    >
                        {posting ? '投稿中...' : '投稿する'}
                    </button>
                </form>
            </div>

            {/* フィルター */}
            <div className="ideas-filter-row">
                {['all', 'unused', 'used'].map(f => (
                    <button
                        key={f}
                        className={`btn ideas-filter-btn ${statusFilter === f ? 'ideas-filter-btn--active' : ''}`}
                        onClick={() => setStatusFilter(f)}
                    >
                        {f === 'all' ? 'すべて' : STATUS_LABELS[f].label}
                        <span className="ideas-filter-count">
                            {f === 'all'
                                ? ideas.length
                                : ideas.filter(i => i.status === f).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* アイデア一覧 */}
            {loading ? (
                <div className="loading-spinner">
                    <div className="spinner"></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="ideas-empty">
                    <span style={{ fontSize: '2rem' }}>💭</span>
                    <p>{statusFilter === 'all' ? 'まだアイデアがありません。最初のアイデアを投稿しましょう！' : 'この条件のアイデアはありません。'}</p>
                </div>
            ) : (
                <div className="ideas-list">
                    {filtered.map(idea => {
                        const { label, className } = STATUS_LABELS[idea.status] || STATUS_LABELS.unused
                        const isAuthor = idea.authorId === user.uid
                        return (
                            <div key={idea.id} className={`card idea-card ${idea.status === 'used' ? 'idea-card--used' : ''}`}>
                                {/* カードヘッダー */}
                                <div className="idea-card-header">
                                    <div className="idea-card-meta">
                                        <span className="idea-author">{idea.authorName}</span>
                                        <span className="idea-date">{formatDate(idea.createdAt)}</span>
                                    </div>
                                    <span className={`idea-badge ${className}`}>{label}</span>
                                </div>

                                {/* タイトル */}
                                <h3 className="idea-title">{idea.title}</h3>

                                {/* 補足 */}
                                {idea.description && (
                                    <p className="idea-description">{idea.description}</p>
                                )}

                                {/* リアクション */}
                                <div className="idea-reactions">
                                    {REACTIONS.map(emoji => {
                                        const users = idea.reactions?.[emoji] || []
                                        const reacted = users.includes(user.uid)
                                        return (
                                            <button
                                                key={emoji}
                                                className={`idea-reaction-btn ${reacted ? 'idea-reaction-btn--active' : ''}`}
                                                onClick={() => handleReaction(idea, emoji)}
                                                title={reacted ? 'リアクションを取り消す' : 'リアクション'}
                                            >
                                                {emoji}
                                                {users.length > 0 && (
                                                    <span className="idea-reaction-count">{users.length}</span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* アクション */}
                                <div className="idea-actions">
                                    <button
                                        className={`btn idea-status-btn ${idea.status === 'used' ? 'idea-status-btn--revert' : 'idea-status-btn--use'}`}
                                        onClick={() => handleToggleStatus(idea)}
                                    >
                                        {idea.status === 'unused' ? '✓ 使用済にする' : '↩ 未使用に戻す'}
                                    </button>

                                    {isAuthor && (
                                        deleteConfirmId === idea.id ? (
                                            <div className="idea-delete-confirm">
                                                <span>削除しますか？</span>
                                                <button
                                                    className="btn btn--danger"
                                                    style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                                    onClick={() => handleDelete(idea.id)}
                                                >
                                                    削除
                                                </button>
                                                <button
                                                    className="btn btn--secondary"
                                                    style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                                    onClick={() => setDeleteConfirmId(null)}
                                                >
                                                    キャンセル
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                className="btn idea-delete-btn"
                                                onClick={() => setDeleteConfirmId(idea.id)}
                                                title="削除"
                                            >
                                                🗑 削除
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
