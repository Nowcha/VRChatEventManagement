import { useState, useEffect, useMemo } from 'react'
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    getDocs,
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

const REACTIONS = ['❤️', '👍', '🤔', '🕐', '❌']

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
    const [copiedId, setCopiedId] = useState(null)
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({ authorName: '', title: '', description: '' })
    const [saving, setSaving] = useState(false)
    const [allUsers, setAllUsers] = useState([])
    const [sortOrder, setSortOrder] = useState('desc') // 'desc' = 新しい順, 'asc' = 古い順
    const [reactionFilter, setReactionFilter] = useState(new Set())
    const [hoveredReaction, setHoveredReaction] = useState(null) // { ideaId, emoji }

    // ユーザー一覧取得
    useEffect(() => {
        getDocs(collection(db, 'users')).then(snap => {
            setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        }).catch(err => console.error('ユーザー取得エラー:', err))
    }, [])

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

    // 編集開始
    const handleEditStart = (idea) => {
        setEditingId(idea.id)
        setEditForm({
            authorName: idea.authorName,
            title: idea.title,
            description: idea.description || ''
        })
        setDeleteConfirmId(null)
    }

    // 編集保存
    const handleEditSave = async (id) => {
        if (!editForm.title.trim()) return
        setSaving(true)
        try {
            await updateDoc(doc(db, 'ideas', id), {
                authorName: editForm.authorName.trim() || 'Unknown',
                title: editForm.title.trim(),
                description: editForm.description.trim()
            })
            setEditingId(null)
        } catch (error) {
            console.error('編集保存エラー:', error)
        } finally {
            setSaving(false)
        }
    }

    // コピー
    const handleCopy = (idea) => {
        const text = `【プレオープン】Bar 未完 第○回【${idea.title}】`
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(idea.id)
            setTimeout(() => setCopiedId(null), 2000)
        }).catch(() => {
            // clipboard API非対応環境のフォールバック
            const el = document.createElement('textarea')
            el.value = text
            document.body.appendChild(el)
            el.select()
            document.execCommand('copy')
            document.body.removeChild(el)
            setCopiedId(idea.id)
            setTimeout(() => setCopiedId(null), 2000)
        })
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

    const toggleReactionFilter = (emoji) => {
        setReactionFilter(prev => {
            const next = new Set(prev)
            if (next.has(emoji)) next.delete(emoji)
            else next.add(emoji)
            return next
        })
    }

    const filtered = useMemo(() => {
        return ideas
            .filter(i => {
                if (statusFilter !== 'all' && i.status !== statusFilter) return false
                if (reactionFilter.size === 0) return true
                for (const emoji of reactionFilter) {
                    if ((i.reactions?.[emoji] || []).length > 0) return true
                }
                return false
            })
            .sort((a, b) => {
                const ta = a.createdAt?.toMillis?.() ?? 0
                const tb = b.createdAt?.toMillis?.() ?? 0
                return sortOrder === 'asc' ? ta - tb : tb - ta
            })
    }, [ideas, statusFilter, reactionFilter, sortOrder])

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

            {/* フィルター & ソート */}
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
                <div className="ideas-reaction-filter">
                    {REACTIONS.map(emoji => (
                        <button
                            key={emoji}
                            className={`btn ideas-reaction-filter-btn ${reactionFilter.has(emoji) ? 'ideas-reaction-filter-btn--active' : ''}`}
                            onClick={() => toggleReactionFilter(emoji)}
                            title={`${emoji} が押されたアイデアで絞り込む`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
                <button
                    className="btn ideas-sort-btn"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                    title="並び順を切り替え"
                >
                    {sortOrder === 'desc' ? '↓ 新しい順' : '↑ 古い順'}
                </button>
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
                <div className="ideas-grid">
                    {filtered.map(idea => {
                        const { label, className } = STATUS_LABELS[idea.status] || STATUS_LABELS.unused
                        const isAuthor = idea.authorId === user.uid
                        return (
                            <div key={idea.id} className={`card idea-card ${idea.status === 'used' ? 'idea-card--used' : ''}`}>
                                {editingId === idea.id ? (
                                    /* 編集モード */
                                    <div className="idea-edit-form">
                                        <div className="form-group" style={{ marginBottom: 'var(--space-sm)' }}>
                                            <label className="form-label">作成者</label>
                                            <select
                                                className="form-input"
                                                value={editForm.authorName}
                                                onChange={e => setEditForm(f => ({ ...f, authorName: e.target.value }))}
                                            >
                                                {allUsers.map(u => (
                                                    <option key={u.id} value={u.displayName || u.id}>
                                                        {u.displayName || u.id}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 'var(--space-sm)' }}>
                                            <label className="form-label">アイデアタイトル <span style={{ color: 'var(--accent-pink)' }}>*</span></label>
                                            <input
                                                className="form-input"
                                                type="text"
                                                value={editForm.title}
                                                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                                maxLength={100}
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                                            <label className="form-label">補足・メモ</label>
                                            <textarea
                                                className="form-input"
                                                style={{ resize: 'vertical', minHeight: '64px' }}
                                                value={editForm.description}
                                                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                                maxLength={300}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                            <button
                                                className="btn btn--primary"
                                                style={{ fontSize: '0.85rem', padding: '6px 16px' }}
                                                onClick={() => handleEditSave(idea.id)}
                                                disabled={saving || !editForm.title.trim()}
                                            >
                                                {saving ? '保存中...' : '保存'}
                                            </button>
                                            <button
                                                className="btn btn--secondary"
                                                style={{ fontSize: '0.85rem', padding: '6px 16px' }}
                                                onClick={() => setEditingId(null)}
                                                disabled={saving}
                                            >
                                                キャンセル
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* 表示モード */
                                    <>
                                        {/* カードヘッダー */}
                                        <div className="idea-card-header">
                                            <div className="idea-card-meta">
                                                <span className="idea-author">{idea.authorName}</span>
                                                <span className="idea-date">{formatDate(idea.createdAt)}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                                <span className={`idea-badge ${className}`}>{label}</span>
                                                <button
                                                    className="btn idea-edit-btn"
                                                    onClick={() => handleEditStart(idea)}
                                                    title="編集"
                                                >
                                                    ✎
                                                </button>
                                            </div>
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
                                                const reactedUsers = idea.reactions?.[emoji] || []
                                                const reacted = reactedUsers.includes(user.uid)
                                                const isHovered = hoveredReaction?.ideaId === idea.id && hoveredReaction?.emoji === emoji
                                                const tooltipNames = reactedUsers.map(uid => allUsers.find(u => u.id === uid)?.displayName || uid).join(', ')
                                                return (
                                                    <button
                                                        key={emoji}
                                                        className={`idea-reaction-btn ${reacted ? 'idea-reaction-btn--active' : ''}`}
                                                        onClick={() => handleReaction(idea, emoji)}
                                                        onMouseEnter={() => reactedUsers.length > 0 && setHoveredReaction({ ideaId: idea.id, emoji })}
                                                        onMouseLeave={() => setHoveredReaction(null)}
                                                    >
                                                        {emoji}
                                                        {reactedUsers.length > 0 && (
                                                            <span className="idea-reaction-count">{reactedUsers.length}</span>
                                                        )}
                                                        {isHovered && tooltipNames && (
                                                            <span className="idea-reaction-tooltip">{tooltipNames}</span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {/* アクション */}
                                        <div className="idea-actions">
                                            <button
                                                className={`btn idea-copy-btn ${copiedId === idea.id ? 'idea-copy-btn--copied' : ''}`}
                                                onClick={() => handleCopy(idea)}
                                                title="クリップボードにコピー"
                                            >
                                                {copiedId === idea.id ? '✓ コピー済' : '⧉ コピー'}
                                            </button>
                                            <button
                                                className={`btn idea-status-btn ${idea.status === 'used' ? 'idea-status-btn--revert' : 'idea-status-btn--use'}`}
                                                onClick={() => handleToggleStatus(idea)}
                                            >
                                                {idea.status === 'unused' ? '✓ 使用済にする' : '↩ 未使用に戻す'}
                                            </button>

                                            {deleteConfirmId === idea.id ? (
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
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

