import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, where, writeBatch, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function FeedbacksPage() {
    const { user } = useAuth()
    const [events, setEvents] = useState([])
    const [customers, setCustomers] = useState([])
    const [feedbacks, setFeedbacks] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingFeedback, setEditingFeedback] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all') // 'all', 'unwritten', 'written', 'posted'
    const [castFilter, setCastFilter] = useState('all') // 'all' or cast.id
    const [selectedFeedbackIds, setSelectedFeedbackIds] = useState([])
    const [customerSearchText, setCustomerSearchText] = useState('')
    const [formData, setFormData] = useState({
        eventId: '',
        customerIds: [],
        assignedCastId: '',
        content: '',
        status: 'unwritten'
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            // イベント
            const eventsQ = query(collection(db, 'events'), orderBy('date', 'desc'))
            const eventsSnap = await getDocs(eventsQ)
            const eventsList = eventsSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                date: d.data().date?.toDate()
            }))
            setEvents(eventsList)
            setEvents(eventsList)

            // 顧客
            const custSnap = await getDocs(query(collection(db, 'customers'), orderBy('vrchatName')))
            setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })))

            // 感想
            const fbSnap = await getDocs(collection(db, 'feedbacks'))
            setFeedbacks(fbSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate()
            })))

            // ユーザー（キャスト一覧）
            const usersSnap = await getDocs(collection(db, 'users'))
            setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch (error) {
            console.error('データ取得エラー:', error)
        } finally {
            setLoading(false)
        }
    }

    const openCreateModal = () => {
        setEditingFeedback(null)
        setFormData({
            eventId: events[0]?.id || '',
            customerIds: customers[0] ? [customers[0].id] : [],
            assignedCastId: user.uid,
            content: '',
            status: 'unwritten'
        })
        setShowModal(true)
    }

    const openEditModal = (fb) => {
        setEditingFeedback(fb)
        setFormData({
            eventId: fb.eventId || events[0]?.id || '',
            customerIds: fb.customerIds || (fb.customerId ? [fb.customerId] : []),
            assignedCastId: fb.assignedCastId || '',
            content: fb.content || '',
            status: fb.status || 'unwritten'
        })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const data = {
                eventId: formData.eventId,
                customerIds: formData.customerIds,
                assignedCastId: formData.assignedCastId,
                content: formData.content,
                status: formData.status
            }

            if (editingFeedback) {
                await updateDoc(doc(db, 'feedbacks', editingFeedback.id), data)
            } else {
                await addDoc(collection(db, 'feedbacks'), {
                    ...data,
                    createdAt: new Date()
                })
            }

            setShowModal(false)
            loadData()
        } catch (error) {
            console.error('感想保存エラー:', error)
        }
    }

    const handleDeleteFeedback = async () => {
        if (!editingFeedback) return
        if (!window.confirm('この感想を削除しますか？')) return
        try {
            await deleteDoc(doc(db, 'feedbacks', editingFeedback.id))
            setShowModal(false)
            loadData()
        } catch (error) {
            console.error('削除エラー:', error)
        }
    }

    const getCustomerNames = (ids = [], singleId) => {
        const idArray = ids.length > 0 ? ids : (singleId ? [singleId] : [])
        if (idArray.length === 0) return '不明'
        return idArray.map(id => customers.find(c => c.id === id)?.vrchatName || '不明').join(', ')
    }
    const getCastName = (id) => allUsers.find(u => u.id === id)?.displayName || '不明'
    const getEventTitle = (id) => {
        const ev = events.find(e => e.id === id)
        if (!ev) return '不明'
        const d = ev.date
        if (!d) return '不明'
        return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${ev.timeSlot || ''}回`
    }
    const getEventDateFormatted = (id) => {
        const ev = events.find(e => e.id === id)
        if (!ev) return '不明'
        const d = ev.date
        if (!d) return '不明'
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${ev.timeSlot || ''}回`
    }

    const filteredFeedbacks = feedbacks.filter(fb => {
        const matchStatus = statusFilter === 'all' || fb.status === statusFilter
        const matchCast = castFilter === 'all' || fb.assignedCastId === castFilter
        return matchStatus && matchCast
    })

    const toggleSelection = (id) => {
        setSelectedFeedbackIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const selectAll = () => {
        if (selectedFeedbackIds.length === filteredFeedbacks.length) {
            setSelectedFeedbackIds([])
        } else {
            setSelectedFeedbackIds(filteredFeedbacks.map(f => f.id))
        }
    }

    const handleBulkStatusChange = async (newStatus) => {
        if (selectedFeedbackIds.length === 0) return
        try {
            const batch = writeBatch(db)
            for (const id of selectedFeedbackIds) {
                batch.update(doc(db, 'feedbacks', id), { status: newStatus })
            }
            await batch.commit()
            setSelectedFeedbackIds([])
            loadData()
        } catch (error) {
            console.error('一括更新エラー:', error)
        }
    }

    const handleCopy = (fb, e) => {
        e.stopPropagation()
        const customerNames = getCustomerNames(fb.customerIds, fb.customerId)
        const textToCopy = `お客様: ${customerNames}\n${fb.content || ''}`
        navigator.clipboard.writeText(textToCopy)
            .then(() => alert('お客様の名前と感想をコピーしました。'))
            .catch(err => console.error('コピー失敗:', err))
    }

    const formatDate = (date) => {
        if (!date) return '-'
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric', month: 'short', day: 'numeric'
        }).format(date instanceof Date ? date : new Date(date))
    }

    const getStatusBadge = (status) => {
        const map = {
            unwritten: { class: 'badge-unwritten', label: '未入力' },
            written: { class: 'badge-written', label: '入力済み' },
            posted: { class: 'badge-posted', label: '投稿済み' }
        }
        const s = map[status] || map.unwritten
        return <span className={`badge ${s.class}`}>{s.label}</span>
    }

    if (loading) {
        return <div className="loading-spinner"><div className="spinner"></div></div>
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="page-title">感想・接客記録</h1>
                        <p className="page-subtitle">お客さまごとの接客メモと感想管理</p>
                    </div>
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        ＋ 感想入力
                    </button>
                </div>
            </div>

            {/* フィルタ */}
            <div className="flex gap-md mb-lg" style={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="flex gap-sm items-center">
                    {/* ステータスフィルタ */}
                    <div className="flex gap-sm">
                        {[
                            { id: 'all', label: '全件表示' },
                            { id: 'unwritten', label: '未入力' },
                            { id: 'written', label: '入力済み' },
                            { id: 'posted', label: '投稿済み' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => {
                                    setStatusFilter(tab.id)
                                    setSelectedFeedbackIds([]) // フィルタ変更時に選択を解除
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* 担当キャストフィルタ */}
                    <select
                        className="form-select form-select-sm"
                        style={{ width: 'auto', minWidth: '140px', marginLeft: '8px' }}
                        value={castFilter}
                        onChange={e => {
                            setCastFilter(e.target.value)
                            setSelectedFeedbackIds([])
                        }}
                    >
                        <option value="all">すべての担当者</option>
                        {allUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.displayName}</option>
                        ))}
                    </select>
                </div>

                {selectedFeedbackIds.length > 0 && (
                    <div className="flex gap-sm items-center">
                        <span className="text-sm text-muted">{selectedFeedbackIds.length}件選択中:</span>
                        <select
                            className="form-select"
                            style={{ width: 'auto', minWidth: '150px' }}
                            onChange={e => {
                                if (e.target.value) {
                                    handleBulkStatusChange(e.target.value)
                                    e.target.value = ''
                                }
                            }}
                            value=""
                        >
                            <option value="" disabled>ステータスを一括変更</option>
                            <option value="unwritten">未入力にする</option>
                            <option value="written">入力済みにする</option>
                            <option value="posted">投稿済みにする</option>
                        </select>
                    </div>
                )}
            </div>

            {/* 感想一覧 */}
            {filteredFeedbacks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="flex gap-sm items-center mb-sm" style={{ paddingLeft: '8px' }}>
                        <input
                            type="checkbox"
                            checked={selectedFeedbackIds.length === filteredFeedbacks.length && filteredFeedbacks.length > 0}
                            onChange={selectAll}
                            style={{ accentColor: 'var(--accent-pink)', width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span className="text-sm text-muted" style={{ cursor: 'pointer' }} onClick={selectAll}>
                            すべて選択/解除
                        </span>
                    </div>

                    {filteredFeedbacks.map(fb => (
                        <div key={fb.id} className="card" style={{ display: 'flex', alignItems: 'center', padding: '24px', gap: '32px' }}>
                            {/* Checkbox */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedFeedbackIds.includes(fb.id)}
                                    onChange={() => toggleSelection(fb.id)}
                                    style={{ accentColor: 'var(--accent-pink)', width: '22px', height: '22px', cursor: 'pointer' }}
                                />
                            </div>

                            {/* Main Content Area */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', cursor: 'pointer' }} onClick={() => openEditModal(fb)}>

                                {/* Top Row: Date */}
                                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                                    {getEventDateFormatted(fb.eventId)}
                                </div>

                                {/* Bottom Row: 3 columns */}
                                <div style={{ display: 'flex', alignItems: 'flex-start' }}>

                                    {/* Column 1: Customer, Cast, Status */}
                                    <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', width: '100px', textAlign: 'justify', textAlignLast: 'justify' }}>お客さま</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginRight: '16px' }}>：</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                                                {getCustomerNames(fb.customerIds, fb.customerId)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', width: '100px', textAlign: 'justify', textAlignLast: 'justify' }}>担当</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginRight: '16px' }}>：</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                                                {getCastName(fb.assignedCastId)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', width: '100px', textAlign: 'justify', textAlignLast: 'justify' }}>ステータス</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginRight: '16px' }}>：</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                                                {{ unwritten: '未入力', written: '入力済み', posted: '投稿済み' }[fb.status] || '未入力'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Column 2: Feedback Content */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '24px' }}>
                                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>感想</span>
                                        <div style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                            {fb.content || ''}
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Right End: Copy Button */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <button
                                    className="btn btn-ghost"
                                    onClick={(e) => handleCopy(fb, e)}
                                    style={{ padding: '8px', fontSize: '1rem', color: 'var(--text-secondary)' }}
                                    title="名前と感想をコピー"
                                >
                                    コピー
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">✎</div>
                    <p className="empty-state-text">感想記録がありません</p>
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        最初の感想を入力
                    </button>
                </div>
            )}

            {/* 感想入力/編集モーダル */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingFeedback ? '感想の編集' : '感想入力'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">イベント</label>
                                    <select
                                        className="form-select"
                                        value={formData.eventId}
                                        onChange={e => setFormData({ ...formData, eventId: e.target.value })}
                                        required
                                    >
                                        <option value="">選択してください</option>
                                        {events.map(ev => (
                                            <option key={ev.id} value={ev.id}>{getEventTitle(ev.id)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">対象のお客さま（最大3名まで）</label>
                                    <input
                                        type="text"
                                        className="form-input mb-sm"
                                        placeholder="お客さま名で検索..."
                                        value={customerSearchText}
                                        onChange={e => setCustomerSearchText(e.target.value)}
                                        style={{ marginBottom: '8px' }}
                                    />
                                    <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {customers
                                            .filter(c => c.vrchatName.toLowerCase().includes(customerSearchText.toLowerCase()))
                                            .map(c => (
                                                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.customerIds.includes(c.id)}
                                                        onChange={(e) => {
                                                            const current = formData.customerIds || []
                                                            if (current.includes(c.id)) {
                                                                setFormData({ ...formData, customerIds: current.filter(id => id !== c.id) })
                                                            } else if (current.length < 3) {
                                                                setFormData({ ...formData, customerIds: [...current, c.id] })
                                                            } else {
                                                                alert('最大3名までしか選択できません。')
                                                            }
                                                        }}
                                                        style={{ accentColor: 'var(--accent-pink)', width: '16px', height: '16px' }}
                                                    />
                                                    <span className="text-sm">{c.vrchatName}</span>
                                                </label>
                                            ))}
                                    </div>
                                    <span className="text-xs text-muted" style={{ marginTop: '4px', display: 'block' }}>
                                        現在 {formData.customerIds.length} 名選択中
                                    </span>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">担当キャスト</label>
                                    <select
                                        className="form-select"
                                        value={formData.assignedCastId}
                                        onChange={e => setFormData({ ...formData, assignedCastId: e.target.value })}
                                        required
                                    >
                                        <option value="">選択してください</option>
                                        {allUsers.map(u => (
                                            <option key={u.id} value={u.id}>{u.displayName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">感想・メモ</label>
                                    <textarea
                                        className="form-textarea"
                                        value={formData.content}
                                        onChange={e => setFormData({ ...formData, content: e.target.value })}
                                        placeholder="お客さまへの感想や接客メモを入力..."
                                        style={{ minHeight: '150px' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">ステータス</label>
                                    <select
                                        className="form-select"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="unwritten">未入力</option>
                                        <option value="written">入力済み</option>
                                        <option value="posted">投稿済み</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ justifyContent: editingFeedback ? 'space-between' : 'flex-end' }}>
                                {editingFeedback && (
                                    <button type="button" className="btn btn-danger" onClick={handleDeleteFeedback}>
                                        削除
                                    </button>
                                )}
                                <div className="flex gap-sm">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                        キャンセル
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        {editingFeedback ? '更新' : '保存'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
