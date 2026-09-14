import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

const TIME_SLOTS = ['21:00', '24:00']

/** Local YYYY-MM-DD. `toISOString()` would shift the day in JST. */
const toDateKey = (date) => {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(d.getTime())) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A visit is unique per (date, time slot, customer) — the cast is not part of the key. */
const visitKey = (dateKey, timeSlot, customerId) => `${dateKey}|${timeSlot}|${customerId}`

export default function VisitsPage() {
    const { user } = useAuth()
    const [customers, setCustomers] = useState([])
    const [visits, setVisits] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [showModal, setShowModal] = useState(false)

    useBodyScrollLock(showModal)
    const [editingVisit, setEditingVisit] = useState(null)
    const [castFilter, setCastFilter] = useState('all')
    const [customerFilter, setCustomerFilter] = useState('all')
    const [customerFilterSearch, setCustomerFilterSearch] = useState('')
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
    const [customerSearchText, setCustomerSearchText] = useState('')
    const [formError, setFormError] = useState('')
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        visitDate: '',
        timeSlot: '21:00',
        customerIds: [],
        assignedCastId: '',
        memo: ''
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const fetchVisits = async () => {
        const snap = await getDocs(query(collection(db, 'visits'), orderBy('visitDate', 'desc')))
        return snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            visitDate: d.data().visitDate?.toDate(),
            createdAt: d.data().createdAt?.toDate()
        }))
    }

    const loadData = async () => {
        try {
            const custSnap = await getDocs(query(collection(db, 'customers'), orderBy('vrchatName')))
            setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })))

            setVisits(await fetchVisits())

            const usersSnap = await getDocs(collection(db, 'users'))
            setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch (error) {
            console.error('データ取得エラー:', error)
        } finally {
            setLoading(false)
        }
    }

    const openCreateModal = () => {
        setEditingVisit(null)
        setFormError('')
        setFormData({
            visitDate: toDateKey(new Date()),
            timeSlot: '21:00',
            customerIds: [],
            assignedCastId: user.uid,
            memo: ''
        })
        setShowModal(true)
    }

    const openEditModal = (visit) => {
        setEditingVisit(visit)
        setFormError('')
        setFormData({
            visitDate: toDateKey(visit.visitDate),
            timeSlot: visit.timeSlot || '21:00',
            customerIds: visit.customerIds || [],
            assignedCastId: visit.assignedCastId || '',
            memo: visit.memo || ''
        })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setCustomerSearchText('')
        setFormError('')
    }

    /**
     * Returns the customers already recorded for this date + time slot, so the
     * caller can refuse the save. Checked against a fresh read rather than the
     * list in state: another cast may have added the same visit meanwhile.
     */
    const findDuplicates = (latestVisits) => {
        const taken = new Map()
        for (const v of latestVisits) {
            if (editingVisit && v.id === editingVisit.id) continue
            const key = toDateKey(v.visitDate)
            for (const cid of v.customerIds || []) {
                taken.set(visitKey(key, v.timeSlot || '21:00', cid), v)
            }
        }
        return formData.customerIds.filter(cid =>
            taken.has(visitKey(formData.visitDate, formData.timeSlot, cid))
        )
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (saving) return
        setFormError('')

        if (formData.customerIds.length === 0) {
            setFormError('お客さまを1人以上選択してください。')
            return
        }

        setSaving(true)
        try {
            const latestVisits = await fetchVisits()
            const duplicates = findDuplicates(latestVisits)
            if (duplicates.length > 0) {
                const names = duplicates.map(id => getCustomerName(id)).join('、')
                setFormError(
                    `${formData.visitDate} ${formData.timeSlot} の ${names} の接客記録は既に登録されています。`
                )
                setVisits(latestVisits)
                return
            }

            const data = {
                visitDate: Timestamp.fromDate(new Date(`${formData.visitDate}T00:00:00`)),
                timeSlot: formData.timeSlot,
                customerIds: formData.customerIds,
                assignedCastId: formData.assignedCastId,
                memo: formData.memo
            }

            if (editingVisit) {
                await updateDoc(doc(db, 'visits', editingVisit.id), data)
            } else {
                await addDoc(collection(db, 'visits'), {
                    ...data,
                    createdAt: new Date(),
                    createdBy: user.uid
                })
            }

            closeModal()
            loadData()
        } catch (error) {
            console.error('接客記録の保存エラー:', error)
            setFormError('保存に失敗しました。通信状況を確認して再度お試しください。')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!editingVisit) return
        if (!window.confirm('この接客記録を削除しますか？')) return
        try {
            await deleteDoc(doc(db, 'visits', editingVisit.id))
            closeModal()
            loadData()
        } catch (error) {
            console.error('削除エラー:', error)
            setFormError('削除に失敗しました。')
        }
    }

    const getCustomerName = (id) => customers.find(c => c.id === id)?.vrchatName || '不明'
    const getCustomerNames = (ids = []) =>
        ids.length === 0 ? '不明' : ids.map(getCustomerName).join(', ')
    const getCastName = (id) => allUsers.find(u => u.id === id)?.displayName || '不明'

    const formatVisitDate = (visit) => {
        const key = toDateKey(visit.visitDate)
        if (!key) return '不明'
        return `${key.replace(/-/g, '/')} ${visit.timeSlot || ''}`.trim()
    }

    const filteredVisits = visits.filter(v => {
        const matchCast = castFilter === 'all' || v.assignedCastId === castFilter
        const matchCustomer = customerFilter === 'all' || (v.customerIds || []).includes(customerFilter)
        return matchCast && matchCustomer
    }).sort((a, b) => {
        const diff = (b.visitDate?.getTime() || 0) - (a.visitDate?.getTime() || 0)
        if (diff !== 0) return diff
        // Same day: the later slot is the later visit.
        return (b.timeSlot || '').localeCompare(a.timeSlot || '')
    })

    if (loading) {
        return <div className="loading-spinner"><div className="spinner"></div></div>
    }

    return (
        <div className="fade-in">
            <div className="sticky-header">
                <div className="page-header" style={{ marginBottom: '16px' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="page-title">接客記録</h1>
                            <p className="page-subtitle">来店されたお客さまの接客履歴（{visits.length}件）</p>
                        </div>
                        <button className="btn btn-primary" onClick={openCreateModal}>
                            ＋ 接客記録を追加
                        </button>
                    </div>
                </div>

                {/* フィルタ */}
                <div className="flex gap-md record-filter-bar" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="flex gap-sm items-center record-status-filter">
                        {/* 担当キャストフィルタ */}
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

                        {/* お客さまフィルタ（検索コンボボックス） */}
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

            {/* 接客記録一覧 */}
            {filteredVisits.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredVisits.map(visit => (
                        <div key={visit.id} className="card record-card">
                            <div className="record-card-body" onClick={() => openEditModal(visit)}>
                                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                                    {formatVisitDate(visit)}
                                </div>

                                <div className="record-card-columns">
                                    <div className="record-card-meta">
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', width: '100px', textAlign: 'justify', textAlignLast: 'justify' }}>お客さま</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginRight: '16px' }}>：</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                                                {getCustomerNames(visit.customerIds)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', width: '100px', textAlign: 'justify', textAlignLast: 'justify' }}>担当</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginRight: '16px' }}>：</span>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                                                {getCastName(visit.assignedCastId)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="record-card-content">
                                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>メモ</span>
                                        <div style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                            {visit.memo || '—'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">✎</div>
                    <p className="empty-state-text">
                        {castFilter !== 'all' || customerFilter !== 'all'
                            ? '条件に一致する接客記録がありません'
                            : '接客記録がありません'}
                    </p>
                    {castFilter === 'all' && customerFilter === 'all' && (
                        <button className="btn btn-primary" onClick={openCreateModal}>
                            最初の接客記録を追加
                        </button>
                    )}
                </div>
            )}

            {/* 接客記録の入力/編集モーダル */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingVisit ? '接客記録の編集' : '接客記録を追加'}
                            </h3>
                            <button className="modal-close" onClick={closeModal}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="visit-date">来店日</label>
                                    <div className="flex gap-sm">
                                        <input
                                            id="visit-date"
                                            type="date"
                                            className="form-input"
                                            value={formData.visitDate}
                                            onChange={e => setFormData({ ...formData, visitDate: e.target.value })}
                                            required
                                            style={{ flex: 1 }}
                                        />
                                        <select
                                            className="form-select"
                                            value={formData.timeSlot}
                                            onChange={e => setFormData({ ...formData, timeSlot: e.target.value })}
                                            aria-label="時間帯"
                                            style={{ width: '120px' }}
                                        >
                                            {TIME_SLOTS.map(slot => (
                                                <option key={slot} value={slot}>{slot}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">対象のお客さま</label>
                                    <input
                                        type="text"
                                        className="form-input mb-sm"
                                        placeholder="お客さま名で検索..."
                                        value={customerSearchText}
                                        onChange={e => setCustomerSearchText(e.target.value)}
                                        style={{ marginBottom: '8px' }}
                                    />
                                    {formData.customerIds.length > 0 && (
                                        <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {formData.customerIds.map(id => (
                                                <span key={id} style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    padding: '2px 10px', borderRadius: '999px',
                                                    background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                                                    fontSize: '0.8rem', color: 'var(--text-primary)'
                                                }}>
                                                    {getCustomerName(id)}
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, customerIds: formData.customerIds.filter(x => x !== id) })}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', lineHeight: 1, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}
                                                    >✕</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {customers
                                            .filter(c => c.vrchatName.toLowerCase().includes(customerSearchText.toLowerCase()))
                                            .map(c => (
                                                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.customerIds.includes(c.id)}
                                                        onChange={() => {
                                                            const current = formData.customerIds || []
                                                            setFormData({
                                                                ...formData,
                                                                customerIds: current.includes(c.id)
                                                                    ? current.filter(id => id !== c.id)
                                                                    : [...current, c.id]
                                                            })
                                                            setFormError('')
                                                        }}
                                                        style={{ accentColor: 'var(--accent-pink)', width: '16px', height: '16px' }}
                                                    />
                                                    <span className="text-sm">{c.vrchatName}</span>
                                                </label>
                                            ))}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="visit-cast">担当キャスト</label>
                                    <select
                                        id="visit-cast"
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
                                    <label className="form-label" htmlFor="visit-memo">メモ</label>
                                    <textarea
                                        id="visit-memo"
                                        className="form-textarea"
                                        value={formData.memo}
                                        onChange={e => setFormData({ ...formData, memo: e.target.value })}
                                        placeholder="接客時の様子や引き継ぎ事項を入力..."
                                        style={{ minHeight: '150px' }}
                                    />
                                </div>
                                {formError && (
                                    <p className="form-error" role="alert">{formError}</p>
                                )}
                            </div>
                            <div className="modal-footer" style={{ justifyContent: editingVisit ? 'space-between' : 'flex-end' }}>
                                {editingVisit && (
                                    <button type="button" className="btn btn-danger" onClick={handleDelete}>
                                        削除
                                    </button>
                                )}
                                <div className="flex gap-sm">
                                    <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                        キャンセル
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? '保存中...' : editingVisit ? '更新' : '保存'}
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
