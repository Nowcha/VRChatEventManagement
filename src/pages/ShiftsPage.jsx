import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function ShiftsPage() {
    const { userData, user } = useAuth()
    const [events, setEvents] = useState([])
    const [shifts, setShifts] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [currentDate, setCurrentDate] = useState(new Date())
    const [loading, setLoading] = useState(true)

    // タブ管理: 'calendar' | 'propose' | 'vote'
    const [activeTab, setActiveTab] = useState('calendar')

    // 候補日入力用
    const [proposeDates, setProposeDates] = useState([])
    const [proposeTimeSlot, setProposeTimeSlot] = useState('21:00')

    // イベント詳細モーダル
    const [showEventDetail, setShowEventDetail] = useState(null)
    const [editTimeSlot, setEditTimeSlot] = useState('')
    const [editMemo, setEditMemo] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const eventsQuery = query(collection(db, 'events'), orderBy('date', 'desc'))
            const eventsSnapshot = await getDocs(eventsQuery)
            const eventsList = eventsSnapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                date: d.data().date?.toDate()
            }))
            setEvents(eventsList)

            const shiftsSnapshot = await getDocs(collection(db, 'shifts'))
            setShifts(shiftsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })))

            const usersSnapshot = await getDocs(collection(db, 'users'))
            setAllUsers(usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch (error) {
            console.error('データ取得エラー:', error)
        } finally {
            setLoading(false)
        }
    }

    // ============================
    //  カレンダー関連
    // ============================
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()
    const daysInMonth = lastDay.getDate()
    const today = new Date()

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']

    const getEventsForDay = (day) => {
        return events.filter(e => {
            if (!e.date) return false
            return e.date.getFullYear() === year &&
                e.date.getMonth() === month &&
                e.date.getDate() === day
        })
    }

    const confirmedEvents = events.filter(e => e.status === 'confirmed')
    const candidateEvents = events.filter(e => e.status === 'candidate')

    // ============================
    //  ① 候補日一括提案
    // ============================
    const toggleProposeDate = (dateStr) => {
        setProposeDates(prev =>
            prev.includes(dateStr)
                ? prev.filter(d => d !== dateStr)
                : [...prev, dateStr]
        )
    }

    const handleSubmitCandidates = async () => {
        if (proposeDates.length === 0) return
        try {
            for (const dateStr of proposeDates) {
                const dateTime = new Date(`${dateStr}T${proposeTimeSlot === '24:00' ? '00:00' : proposeTimeSlot}`)
                await addDoc(collection(db, 'events'), {
                    date: Timestamp.fromDate(dateTime),
                    timeSlot: proposeTimeSlot,
                    memo: '',
                    status: 'candidate',
                    createdBy: user.uid
                })
            }
            setProposeDates([])
            await loadData()
            setActiveTab('vote')
        } catch (error) {
            console.error('候補日作成エラー:', error)
        }
    }

    // ============================
    //  ② 出欠投票
    // ============================
    const handleVote = async (eventId, status) => {
        try {
            const existing = shifts.find(s => s.eventId === eventId && s.userId === user.uid)
            if (existing) {
                await updateDoc(doc(db, 'shifts', existing.id), { status })
            } else {
                await addDoc(collection(db, 'shifts'), {
                    eventId,
                    userId: user.uid,
                    status
                })
            }
            await loadData()
        } catch (error) {
            console.error('出欠更新エラー:', error)
        }
    }

    const getMyVote = (eventId) => {
        const shift = shifts.find(s => s.eventId === eventId && s.userId === user.uid)
        return shift?.status || null
    }

    const getVoteSummary = (eventId) => {
        const eventShifts = shifts.filter(s => s.eventId === eventId)
        return {
            available: eventShifts.filter(s => s.status === 'available').length,
            unavailable: eventShifts.filter(s => s.status === 'unavailable').length,
            total: allUsers.length,
            responded: eventShifts.length,
            details: eventShifts.map(s => ({
                ...s,
                userName: allUsers.find(u => u.id === s.userId)?.displayName || '不明'
            }))
        }
    }

    // ============================
    //  ③ 開催日決定
    // ============================
    const handleConfirmEvent = async (eventId) => {
        try {
            const batch = writeBatch(db)
            batch.update(doc(db, 'events', eventId), { status: 'confirmed' })

            const eventShifts = shifts.filter(s => s.eventId === eventId && s.status === 'available')
            for (const s of eventShifts) {
                batch.update(doc(db, 'shifts', s.id), { status: 'confirmed' })
            }
            await batch.commit()
            await loadData()
        } catch (error) {
            console.error('開催確定エラー:', error)
        }
    }

    const handleCancelCandidate = async (eventId) => {
        if (!window.confirm('この候補日を削除し、データベースからも完全に削除しますか？')) return
        try {
            const batch = writeBatch(db)
            batch.delete(doc(db, 'events', eventId))

            const eventShifts = shifts.filter(s => s.eventId === eventId)
            for (const s of eventShifts) {
                batch.delete(doc(db, 'shifts', s.id))
            }
            await batch.commit()
            await loadData()
        } catch (error) {
            console.error('候補日削除エラー:', error)
        }
    }

    // ============================
    //  ④ イベント詳細・編集
    // ============================
    const openEventDetail = (event) => {
        setShowEventDetail(event)
        setEditTimeSlot(event.timeSlot || '21:00')
        setEditMemo(event.memo || '')
    }

    const handleUpdateEvent = async () => {
        if (!showEventDetail) return
        try {
            await updateDoc(doc(db, 'events', showEventDetail.id), {
                timeSlot: editTimeSlot,
                memo: editMemo
            })
            setShowEventDetail(null)
            await loadData()
        } catch (error) {
            console.error('イベント更新エラー:', error)
        }
    }

    const handleDeleteEvent = async (eventId) => {
        if (!window.confirm('このイベントを削除し、データベースからも完全に削除しますか？（関連するシフト情報も削除されます）')) return
        try {
            const batch = writeBatch(db)
            batch.delete(doc(db, 'events', eventId))

            const eventShifts = shifts.filter(s => s.eventId === eventId)
            for (const s of eventShifts) {
                batch.delete(doc(db, 'shifts', s.id))
            }
            await batch.commit()
            setShowEventDetail(null)
            await loadData()
        } catch (error) {
            console.error('イベント削除エラー:', error)
        }
    }

    const handleShiftUpdate = async (eventId, status) => {
        try {
            const existing = shifts.find(s => s.eventId === eventId && s.userId === user.uid)
            if (existing) {
                await updateDoc(doc(db, 'shifts', existing.id), { status })
            } else {
                await addDoc(collection(db, 'shifts'), {
                    eventId,
                    userId: user.uid,
                    status
                })
            }
            await loadData()
        } catch (error) {
            console.error('シフト更新エラー:', error)
        }
    }

    const getShiftsForEvent = (eventId) => {
        return shifts.filter(s => s.eventId === eventId).map(s => ({
            ...s,
            userName: allUsers.find(u => u.id === s.userId)?.displayName || '不明'
        }))
    }

    // ============================
    //  フォーマッター
    // ============================
    const formatDate = (date) => {
        if (!date) return '-'
        return new Intl.DateTimeFormat('ja-JP', {
            month: 'long', day: 'numeric', weekday: 'short'
        }).format(date)
    }

    const formatFullDate = (date) => {
        if (!date) return '-'
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
        }).format(date)
    }

    if (loading) {
        return <div className="loading-spinner"><div className="spinner"></div></div>
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">シフト管理</h1>
                    <p className="page-subtitle">候補日の提案・出欠入力・開催日決定</p>
                </div>
            </div>

            {/* タブ切り替え */}
            <div className="flex gap-sm mb-lg" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                {[
                    { key: 'calendar', icon: '📅', label: 'カレンダー', count: confirmedEvents.length },
                    { key: 'propose', icon: '📝', label: '候補日提案' },
                    { key: 'vote', icon: '🗳', label: '出欠入力', count: candidateEvents.length }
                ].map(tab => (
                    <button
                        key={tab.key}
                        className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={{ position: 'relative' }}
                    >
                        {tab.icon} {tab.label}
                        {tab.count > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-4px',
                                right: '-4px',
                                background: 'var(--accent-pink)',
                                color: 'white',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                fontSize: '0.65rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ===================================
          タブ: カレンダー（確定済みイベント）
          =================================== */}
            {activeTab === 'calendar' && (
                <div>
                    <div className="calendar">
                        <div className="calendar-header">
                            <button className="btn btn-ghost btn-sm" onClick={prevMonth}>◀</button>
                            <h3 className="calendar-title">{year}年 {month + 1}月</h3>
                            <button className="btn btn-ghost btn-sm" onClick={nextMonth}>▶</button>
                        </div>
                        <div className="calendar-grid">
                            {dayNames.map(day => (
                                <div key={day} className="calendar-day-header">{day}</div>
                            ))}
                            {Array.from({ length: startOffset }).map((_, i) => (
                                <div key={`empty-${i}`} className="calendar-day other-month"></div>
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1
                                const dayEvents = getEventsForDay(day).filter(e => e.status === 'confirmed')
                                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

                                return (
                                    <div
                                        key={day}
                                        className={`calendar-day ${isToday ? 'today' : ''}`}
                                        onClick={() => {
                                            if (dayEvents.length > 0) openEventDetail(dayEvents[0])
                                        }}
                                    >
                                        <div className="calendar-day-number">{day}</div>
                                        {dayEvents.map(ev => {
                                            const casts = getShiftsForEvent(ev.id)
                                                .filter(s => s.status === 'confirmed' || s.status === 'available')
                                                .map(s => s.userName)
                                                .join(', ');
                                            return (
                                                <div key={ev.id} className="calendar-event-dot" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '4px', gap: '2px' }}>
                                                    <span style={{ fontWeight: 'bold' }}>{ev.timeSlot || ''}</span>
                                                    {casts && (
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            color: 'var(--text-secondary)',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            maxWidth: '100%'
                                                        }}>
                                                            {casts}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                </div>
            )}

            {/* ===================================
          タブ: 候補日提案
          =================================== */}
            {activeTab === 'propose' && (
                <div>
                    <div className="card mb-lg">
                        <div className="card-header">
                            <h3 className="card-title">候補日を選択</h3>
                        </div>
                        <p className="text-sm text-muted mb-lg">
                            カレンダーから候補日をクリックして選択してください。複数日を一括で提案できます。
                        </p>

                        {/* 時間帯選択 */}
                        <div className="form-group">
                            <label className="form-label">時間帯区分</label>
                            <select
                                className="form-select"
                                style={{ width: 'auto', minWidth: '140px' }}
                                value={proposeTimeSlot}
                                onChange={e => setProposeTimeSlot(e.target.value)}
                            >
                                <option value="21:00">21:00回</option>
                                <option value="24:00">24:00回</option>
                            </select>
                        </div>

                        {/* 候補日選択用カレンダー */}
                        <div className="calendar" style={{ border: 'none' }}>
                            <div className="calendar-header">
                                <button className="btn btn-ghost btn-sm" onClick={prevMonth}>◀</button>
                                <h3 className="calendar-title">{year}年 {month + 1}月</h3>
                                <button className="btn btn-ghost btn-sm" onClick={nextMonth}>▶</button>
                            </div>
                            <div className="calendar-grid">
                                {dayNames.map(day => (
                                    <div key={day} className="calendar-day-header">{day}</div>
                                ))}
                                {Array.from({ length: startOffset }).map((_, i) => (
                                    <div key={`empty-${i}`} className="calendar-day other-month"></div>
                                ))}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1
                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                    const isSelected = proposeDates.includes(dateStr)
                                    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
                                    const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

                                    return (
                                        <div
                                            key={day}
                                            className={`calendar-day ${isToday ? 'today' : ''} ${isPast ? 'other-month' : ''}`}
                                            onClick={() => !isPast && toggleProposeDate(dateStr)}
                                            style={{
                                                background: isSelected ? 'rgba(232, 67, 147, 0.15)' : undefined,
                                                borderColor: isSelected ? 'var(--accent-pink)' : undefined,
                                                cursor: isPast ? 'default' : 'pointer'
                                            }}
                                        >
                                            <div className="calendar-day-number" style={{
                                                color: isSelected ? 'var(--accent-pink-light)' : undefined,
                                                fontWeight: isSelected ? '600' : undefined
                                            }}>
                                                {day}
                                            </div>
                                            {isSelected && (
                                                <div style={{ fontSize: '0.9rem', textAlign: 'center' }}>✓</div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 選択済み候補日の表示 */}
                        {proposeDates.length > 0 && (
                            <div className="mt-lg">
                                <p className="text-sm text-muted mb-md">
                                    選択中の候補日（{proposeDates.length}日）:
                                </p>
                                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                    {proposeDates.sort().map(d => (
                                        <span key={d} className="tag" style={{ cursor: 'pointer' }} onClick={() => toggleProposeDate(d)}>
                                            {new Date(d).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                                            <span className="tag-remove">✕</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        className="btn btn-primary btn-lg w-full"
                        onClick={handleSubmitCandidates}
                        disabled={proposeDates.length === 0}
                    >
                        {proposeDates.length > 0
                            ? `${proposeDates.length}日分の候補日を提案する`
                            : '候補日を選択してください'
                        }
                    </button>
                </div>
            )}

            {/* ===================================
          タブ: 出欠入力・開催日決定
          =================================== */}
            {activeTab === 'vote' && (
                <div>
                    {candidateEvents.length > 0 ? (
                        <>
                            <div className="card mb-lg" style={{ padding: '16px 20px' }}>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    各候補日に対して出勤可能かどうかを入力してください。全員の出欠状況を確認し、開催日を決定できます。
                                </p>
                            </div>

                            {/* 出欠テーブル */}
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>候補日</th>
                                            <th>時間帯</th>
                                            {allUsers.map(u => (
                                                <th key={u.id} style={{ textAlign: 'center', textTransform: 'none', letterSpacing: '0' }}>
                                                    {u.displayName}
                                                </th>
                                            ))}
                                            <th style={{ textAlign: 'center' }}>集計</th>
                                            <th style={{ textAlign: 'center' }}>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {candidateEvents
                                            .sort((a, b) => (a.date || 0) - (b.date || 0))
                                            .map(ev => {
                                                const summary = getVoteSummary(ev.id)
                                                return (
                                                    <tr key={ev.id}>
                                                        <td>
                                                            <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                                                                {formatDate(ev.date)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="badge badge-confirmed">{ev.timeSlot}回</span>
                                                        </td>
                                                        {allUsers.map(u => {
                                                            const vote = shifts.find(s => s.eventId === ev.id && s.userId === u.id)
                                                            const isMe = u.id === user.uid
                                                            return (
                                                                <td key={u.id} style={{ textAlign: 'center' }}>
                                                                    {isMe ? (
                                                                        <div className="flex gap-sm" style={{ justifyContent: 'center' }}>
                                                                            <button
                                                                                className={`btn btn-sm btn-icon ${getMyVote(ev.id) === 'available' ? 'btn-primary' : 'btn-ghost'}`}
                                                                                onClick={() => handleVote(ev.id, 'available')}
                                                                                title="出勤可"
                                                                                style={{ fontSize: '1rem' }}
                                                                            >
                                                                                ○
                                                                            </button>
                                                                            <button
                                                                                className={`btn btn-sm btn-icon ${getMyVote(ev.id) === 'unavailable' ? 'btn-danger' : 'btn-ghost'}`}
                                                                                onClick={() => handleVote(ev.id, 'unavailable')}
                                                                                title="欠勤"
                                                                                style={{ fontSize: '1rem' }}
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{
                                                                            fontSize: '1.2rem',
                                                                            color: vote?.status === 'available'
                                                                                ? 'var(--color-black)'
                                                                                : vote?.status === 'unavailable'
                                                                                    ? 'var(--color-dark-gray)'
                                                                                    : 'var(--text-tertiary)'
                                                                        }}>
                                                                            {vote?.status === 'available' ? '○' : vote?.status === 'unavailable' ? '✕' : '—'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            )
                                                        })}
                                                        <td style={{ textAlign: 'center' }}>
                                                            <span style={{
                                                                color: summary.available === allUsers.length
                                                                    ? 'var(--color-black)'
                                                                    : summary.available > 0
                                                                        ? 'var(--color-dark-gray)'
                                                                        : 'var(--text-tertiary)',
                                                                fontWeight: 'var(--font-weight-medium)',
                                                                fontFamily: 'var(--font-serif)'
                                                            }}>
                                                                {summary.available}/{summary.total}
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <div className="flex gap-sm" style={{ justifyContent: 'center' }}>
                                                                <button
                                                                    className="btn btn-primary btn-sm"
                                                                    onClick={() => handleConfirmEvent(ev.id)}
                                                                    title="開催決定"
                                                                >
                                                                    決定
                                                                </button>
                                                                <button
                                                                    className="btn btn-danger btn-sm"
                                                                    onClick={() => handleCancelCandidate(ev.id)}
                                                                    title="候補削除"
                                                                >
                                                                    削除
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">🗳</div>
                            <p className="empty-state-text">投票中の候補日はありません</p>
                            <button className="btn btn-primary" onClick={() => setActiveTab('propose')}>
                                候補日を提案する
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ===================================
          イベント詳細・編集モーダル
          =================================== */}
            {showEventDetail && (
                <div className="modal-overlay" onClick={() => setShowEventDetail(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {formatFullDate(showEventDetail.date)}
                            </h3>
                            <button className="modal-close" onClick={() => setShowEventDetail(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {/* 時間帯区分（編集可能） */}
                            <div className="form-group">
                                <label className="form-label">時間帯区分</label>
                                <select
                                    className="form-select"
                                    value={editTimeSlot}
                                    onChange={e => setEditTimeSlot(e.target.value)}
                                >
                                    <option value="21:00">21:00回</option>
                                    <option value="24:00">24:00回</option>
                                </select>
                            </div>

                            {/* メモ（編集可能） */}
                            <div className="form-group">
                                <label className="form-label">メモ</label>
                                <textarea
                                    className="form-textarea"
                                    value={editMemo}
                                    onChange={e => setEditMemo(e.target.value)}
                                    placeholder="メモを入力..."
                                    style={{ minHeight: '80px' }}
                                />
                            </div>

                            {/* ステータス */}
                            <div className="mb-lg">
                                <p className="text-sm text-muted mb-md">ステータス</p>
                                <span className={`badge ${showEventDetail.status === 'confirmed' ? 'badge-confirmed' : 'badge-unwritten'}`}>
                                    {showEventDetail.status === 'confirmed' ? '開催確定' : '候補'}
                                </span>
                            </div>

                            {/* シフト状況 */}
                            <div className="mb-lg">
                                <p className="text-sm text-muted mb-md">出勤メンバー</p>
                                {getShiftsForEvent(showEventDetail.id).length > 0 ? (
                                    getShiftsForEvent(showEventDetail.id).map(s => (
                                        <div key={s.id} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 0',
                                            borderBottom: '1px solid var(--border-subtle)'
                                        }}>
                                            <span className="text-sm">{s.userName}</span>
                                            <span className={`badge badge-${s.status}`}>
                                                {s.status === 'available' ? '出勤可' : s.status === 'unavailable' ? '欠勤' : '確定'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted">まだ回答がありません</p>
                                )}
                            </div>

                            {/* 自分の出欠 */}
                            <div className="mb-lg">
                                <p className="text-sm text-muted mb-md">あなたの出勤</p>
                                <div className="flex gap-sm">
                                    <button
                                        className={`btn btn-sm ${getMyVote(showEventDetail.id) === 'available' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => handleShiftUpdate(showEventDetail.id, 'available')}
                                    >
                                        ○ 出勤可
                                    </button>
                                    <button
                                        className={`btn btn-sm ${getMyVote(showEventDetail.id) === 'unavailable' ? 'btn-danger' : 'btn-secondary'}`}
                                        onClick={() => handleShiftUpdate(showEventDetail.id, 'unavailable')}
                                    >
                                        ✕ 欠勤
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteEvent(showEventDetail.id)}>
                                削除
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={handleUpdateEvent}>
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
