import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export default function CustomersPage() {
    const [customers, setCustomers] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [filterTag, setFilterTag] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState(null)
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const PREDEFINED_TAGS = ['常連', 'VIP', '新規', 'リピーター', '要注意']
    const [formData, setFormData] = useState({
        vrchatName: '',
        firstVisitDate: '',
        tags: [],
        notes: ''
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadCustomers()
    }, [])

    const loadCustomers = async () => {
        try {
            const q = query(collection(db, 'customers'), orderBy('vrchatName'))
            const snapshot = await getDocs(q)

            const fbSnap = await getDocs(collection(db, 'feedbacks'))
            const feedbacks = fbSnap.docs.map(d => d.data())

            setCustomers(snapshot.docs.map(d => {
                const data = d.data()
                const visitCount = feedbacks.filter(fb =>
                    (fb.customerIds && fb.customerIds.includes(d.id)) || fb.customerId === d.id
                ).length
                return {
                    id: d.id,
                    ...data,
                    firstVisitDate: data.firstVisitDate?.toDate(),
                    visitCount // 動的に計算した来店回数をセット
                }
            }))
        } catch (error) {
            console.error('顧客データ取得エラー:', error)
        } finally {
            setLoading(false)
        }
    }

    const openCreateModal = () => {
        setEditingCustomer(null)
        setFormData({ vrchatName: '', firstVisitDate: '', tags: [], notes: '' })
        setShowModal(true)
    }

    const openEditModal = (customer) => {
        setEditingCustomer(customer)
        setFormData({
            vrchatName: customer.vrchatName || '',
            firstVisitDate: customer.firstVisitDate
                ? new Date(customer.firstVisitDate).toISOString().split('T')[0]
                : '',
            tags: customer.tags || [],
            notes: customer.notes || ''
        })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const data = {
                vrchatName: formData.vrchatName,
                firstVisitDate: formData.firstVisitDate
                    ? Timestamp.fromDate(new Date(formData.firstVisitDate))
                    : serverTimestamp(),
                tags: formData.tags,
                notes: formData.notes
            }

            if (editingCustomer) {
                await updateDoc(doc(db, 'customers', editingCustomer.id), data)
            } else {
                await addDoc(collection(db, 'customers'), {
                    ...data,
                    visitCount: 0
                })
            }

            setShowModal(false)
            loadCustomers()
        } catch (error) {
            console.error('顧客保存エラー:', error)
        }
    }

    const handleDelete = async (customerId) => {
        if (!window.confirm('この顧客を削除しますか？')) return
        try {
            await deleteDoc(doc(db, 'customers', customerId))
            setSelectedCustomer(null)
            loadCustomers()
        } catch (error) {
            console.error('顧客削除エラー:', error)
        }
    }

    // フィルタリング
    const allTags = PREDEFINED_TAGS

    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.vrchatName?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesTag = !filterTag || (c.tags || []).includes(filterTag)
        return matchesSearch && matchesTag
    })

    const formatDate = (date) => {
        if (!date) return '-'
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric', month: 'short', day: 'numeric'
        }).format(date instanceof Date ? date : new Date(date))
    }

    if (loading) {
        return <div className="loading-spinner"><div className="spinner"></div></div>
    }

    return (
        <div className="fade-in">
            <div className="sticky-header">
                <div className="page-header" style={{ marginBottom: '16px' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="page-title">顧客データベース</h1>
                            <p className="page-subtitle">{customers.length}名の顧客情報</p>
                        </div>
                        <button className="btn btn-primary" onClick={openCreateModal}>
                            ＋ 顧客登録
                        </button>
                    </div>
                </div>

                {/* 検索・フィルタ */}
                <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
                    <div className="search-bar">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="名前で検索..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {allTags.length > 0 && (
                        <select
                            className="form-select"
                            style={{ width: 'auto', minWidth: '140px' }}
                            value={filterTag}
                            onChange={e => setFilterTag(e.target.value)}
                        >
                            <option value="">すべてのタグ</option>
                            {allTags.map(tag => (
                                <option key={tag} value={tag}>{tag}</option>
                            ))}
                        </select>
                    )}
                </div>
                {/* 顧客テーブル */}
                {filteredCustomers.length > 0 ? (
                    <div className="table-container">
                        <table style={{ tableLayout: 'fixed', width: '100%' }}>
                            <colgroup>
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '35%' }} />
                                <col style={{ width: '18%' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>VRChat表示名</th>
                                    <th>初来店日</th>
                                    <th>来店回数</th>
                                    <th>タグ</th>
                                    <th>備考</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                        </table>
                    </div>
                ) : null}
            </div>

            {/* 顧客テーブル本体 */}
            {filteredCustomers.length > 0 ? (
                <div className="table-container" style={{ borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: '-17px' }}>
                    <table style={{ tableLayout: 'fixed', width: '100%' }}>
                        <colgroup>
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '35%' }} />
                            <col style={{ width: '18%' }} />
                        </colgroup>
                        <tbody>
                            {filteredCustomers.map(customer => (
                                <tr key={customer.id}>
                                    <td>
                                        <span
                                            style={{ cursor: 'pointer', color: 'var(--text-accent)' }}
                                            onClick={() => setSelectedCustomer(customer)}
                                        >
                                            {customer.vrchatName}
                                        </span>
                                    </td>
                                    <td>{formatDate(customer.firstVisitDate)}</td>
                                    <td>{customer.visitCount || 0}</td>
                                    <td>
                                        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                            {(customer.tags || []).map(tag => (
                                                <span key={tag} className="tag">{tag}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="text-sm" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={customer.notes || ''}>
                                            {customer.notes || '-'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex gap-sm">
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(customer)}>
                                                編集
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(customer.id)}>
                                                削除
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">♦</div>
                    <p className="empty-state-text">
                        {searchQuery || filterTag ? '条件に一致する顧客が見つかりません' : '顧客が登録されていません'}
                    </p>
                    {!searchQuery && !filterTag && (
                        <button className="btn btn-primary" onClick={openCreateModal}>
                            最初の顧客を登録
                        </button>
                    )}
                </div>
            )}

            {/* 顧客詳細モーダル */}
            {selectedCustomer && (
                <div className="modal-overlay" onClick={() => setSelectedCustomer(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{selectedCustomer.vrchatName}</h3>
                            <button className="modal-close" onClick={() => setSelectedCustomer(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="mb-lg">
                                <p className="text-sm text-muted">初来店日</p>
                                <p>{formatDate(selectedCustomer.firstVisitDate)}</p>
                            </div>
                            <div className="mb-lg">
                                <p className="text-sm text-muted">来店回数</p>
                                <p style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)' }}>
                                    {selectedCustomer.visitCount || 0}回
                                </p>
                            </div>
                            <div className="mb-lg">
                                <p className="text-sm text-muted">タグ</p>
                                <div className="flex gap-sm mt-md" style={{ flexWrap: 'wrap' }}>
                                    {(selectedCustomer.tags || []).map(tag => (
                                        <span key={tag} className="tag">{tag}</span>
                                    ))}
                                    {(selectedCustomer.tags || []).length === 0 && <span className="text-sm text-muted">なし</span>}
                                </div>
                            </div>
                            <div className="mb-lg">
                                <p className="text-sm text-muted">備考</p>
                                <p className="text-sm">{selectedCustomer.notes || '記載なし'}</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                                setSelectedCustomer(null)
                                openEditModal(selectedCustomer)
                            }}>
                                編集
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 登録/編集モーダル */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingCustomer ? '顧客情報の編集' : '新規顧客登録'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">VRChat表示名</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.vrchatName}
                                        onChange={e => setFormData({ ...formData, vrchatName: e.target.value })}
                                        placeholder="VRChat上の表示名"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">初来店日</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.firstVisitDate}
                                        onChange={e => setFormData({ ...formData, firstVisitDate: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">タグ</label>
                                    <div className="flex gap-md" style={{ flexWrap: 'wrap', marginTop: '8px' }}>
                                        {PREDEFINED_TAGS.map(tag => (
                                            <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.tags.includes(tag)}
                                                    onChange={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            tags: prev.tags.includes(tag)
                                                                ? prev.tags.filter(t => t !== tag)
                                                                : [...prev.tags, tag]
                                                        }))
                                                    }}
                                                    style={{ cursor: 'pointer', accentColor: 'var(--accent-pink)' }}
                                                />
                                                <span className="text-sm">{tag}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">備考</label>
                                    <textarea
                                        className="form-textarea"
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="特記事項やメモ..."
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    キャンセル
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingCustomer ? '更新' : '登録'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
