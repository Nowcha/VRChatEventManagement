import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Read-only view of the retired 感想 workflow.
 *
 * Nothing here writes: the records predate the 接客記録 (visits) model and are
 * kept only so past 感想 stay searchable. New entries go to VisitsPage.
 */
export default function FeedbackArchivePage() {
    const [events, setEvents] = useState([])
    const [customers, setCustomers] = useState([])
    const [feedbacks, setFeedbacks] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [statusFilter, setStatusFilter] = useState('all')
    const [castFilter, setCastFilter] = useState('all')
    const [customerFilter, setCustomerFilter] = useState('all')
    const [customerFilterSearch, setCustomerFilterSearch] = useState('')
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const eventsSnap = await getDocs(query(collection(db, 'events'), orderBy('date', 'desc')))
            setEvents(eventsSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                date: d.data().date?.toDate()
            })))

            const custSnap = await getDocs(query(collection(db, 'customers'), orderBy('vrchatName')))
            setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })))

            const fbSnap = await getDocs(collection(db, 'feedbacks'))
            setFeedbacks(fbSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate()
            })))

            const usersSnap = await getDocs(collection(db, 'users'))
            setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch (error) {
            console.error('アーカイブ取得エラー:', error)
        } finally {
            setLoading(false)
        }
    }

    const customerIdsOf = (fb) =>
        fb.customerIds?.length > 0 ? fb.customerIds : (fb.customerId ? [fb.customerId] : [])

    const getCustomerName = (id) => customers.find(c => c.id === id)?.vrchatName || '不明'
    const getCustomerNames = (fb) => {
        const ids = customerIdsOf(fb)
        return ids.length === 0 ? '不明' : ids.map(getCustomerName).join(', ')
    }
    const getCastName = (id) => allUsers.find(u => u.id === id)?.displayName || '不明'

    const getEventDateFormatted = (id, manualInput) => {
        if (!id && manualInput) return manualInput
        const ev = events.find(e => e.id === id)
        const d = ev?.date
        if (!d) return '不明'
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${ev.timeSlot || ''}`
    }

    const getEventDateObj = (id, manualInput) => {
        if (!id && manualInput) {
            const match = manualInput.match(/(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2})/)
            if (match) {
                return new Date(match[1], parseInt(match[2]) - 1, match[3], match[4], match[5])
            }
            return new Date(0)
        }
        const ev = events.find(e => e.id === id)
        if (!ev || !ev.date) return new Date(0)

        const d = new Date(ev.date)
        if (ev.timeSlot) {
            const [h, m] = ev.timeSlot.split(':')
            d.setHours(parseInt(h), parseInt(m), 0, 0)
        }
        return d
    }

    const filteredFeedbacks = feedbacks.filter(fb => {
        const matchStatus = statusFilter === 'all' || (fb.status || 'unwritten') === statusFilter
        const matchCast = castFilter === 'all' || fb.assignedCastId === castFilter
        const matchCustomer = customerFilter === 'all' || customerIdsOf(fb).includes(customerFilter)
        return matchStatus && matchCast && matchCustomer
    }).sort((a, b) =>
        getEventDateObj(b.eventId, b.eventManualInput).getTime() -
        getEventDateObj(a.eventId, a.eventManualInput).getTime()
    )

    const handleCopy = (fb) => {
        const ids = customerIdsOf(fb)
        const names = ids.length > 0
            ? ids.map(id => `${getCustomerName(id)}さん`).join('、')
            : '不明'

        navigator.clipboard.writeText(`${names}\n${fb.content || ''}`)
            .then(() => alert('お客様の名前と感想をコピーしました。'))
            .catch(err => console.error('コピー失敗:', err))
    }

    const STATUS_LABELS = { unwritten: '未入力', written: '入力済み', posted: '投稿済み' }

    if (loading) {
        return <div className="loading-spinner"><div className="spinner"></div></div>
    }

    return (
        <div className="fade-in">
            <div className="sticky-header">
                <div className="page-header" style={{ marginBottom: '16px' }}>
                    <h1 className="page-title">感想アーカイブ</h1>
                    <p className="page-subtitle">
                        運用を終了した感想・接客記録の履歴（{feedbacks.length}件）。閲覧のみで編集はできません。
                    </p>
                </div>

                {/* フィルタ */}
                <div className="flex gap-md record-filter-bar" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="flex gap-sm items-center record-status-filter">
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
                                    onClick={() => setStatusFilter(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <select
                            className="form-select form-select-sm record-filter-select"
                            value={castFilter}
                            onChange={e => setCastFilter(e.target.value)}
                            aria-label="担当者で絞り込み"
                        >
                            <option value="all">すべての担当者</option>
                            {allUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.displayName}</option>
                            ))}
                        </select>

                        <div className="record-customer-combo">
                            {customerFilter !== 'all' ? (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '4px 10px', borderRadius: '999px',
                                    background: 'rgba(236, 72, 153, 0.15)', border: '1px solid var(--accent-pink)',
                                    fontSize: '0.85rem', color: 'var(--accent-pink)', whiteSpace: 'nowrap'
                                }}>
                                    {getCustomerName(customerFilter)}
                                    <button
                                        type="button"
                                        onClick={() => { setCustomerFilter('all'); setCustomerFilterSearch('') }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--accent-pink)', fontSize: '0.8rem' }}
                                    >✕</button>
                                </span>
                            ) : (
                                <input
                                    type="text"
                                    className="form-input record-customer-input"
                                    placeholder="お客さまで絞り込み..."
                                    value={customerFilterSearch}
                                    onChange={e => { setCustomerFilterSearch(e.target.value); setShowCustomerDropdown(true) }}
                                    onFocus={() => setShowCustomerDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                                />
                            )}
                            {showCustomerDropdown && customerFilter === 'all' && (
                                <div className="record-customer-dropdown">
                                    {customers
                                        .filter(c => c.vrchatName.toLowerCase().includes(customerFilterSearch.toLowerCase()))
                                        .map(c => (
                                            <div
                                                key={c.id}
                                                onMouseDown={() => { setCustomerFilter(c.id); setCustomerFilterSearch(''); setShowCustomerDropdown(false) }}
                                                style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                {c.vrchatName}
                                            </div>
                                        ))
                                    }
                                    {customers.filter(c => c.vrchatName.toLowerCase().includes(customerFilterSearch.toLowerCase())).length === 0 && (
                                        <div style={{ padding: '8px 14px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            見つかりません
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* アーカイブ一覧 */}
            {filteredFeedbacks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredFeedbacks.map(fb => (
                        <div key={fb.id} className="card record-card">
                            <div className="record-card-body" style={{ cursor: 'default' }}>
                                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                                    {getEventDateFormatted(fb.eventId, fb.eventManualInput)}
                                </div>

                                <div className="record-card-columns">
                                    <div className="record-card-meta">
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', width: '100px', textAlign: 'justify', textAlignLast: 'justify' }}>お客さま</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginRight: '16px' }}>：</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                                                {getCustomerNames(fb)}
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
                                                {STATUS_LABELS[fb.status] || '未入力'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="record-card-content">
                                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>感想</span>
                                        <div style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                            {fb.content || ''}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => handleCopy(fb)}
                                    style={{ padding: '8px', fontSize: '1rem', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
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
                    <div className="empty-state-icon">▤</div>
                    <p className="empty-state-text">
                        {feedbacks.length === 0
                            ? 'アーカイブされた感想はありません'
                            : '条件に一致する感想がありません'}
                    </p>
                </div>
            )}
        </div>
    )
}
