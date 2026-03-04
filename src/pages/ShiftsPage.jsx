import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, Timestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useLocation } from 'react-router-dom'

export default function ShiftsPage() {
    const { user } = useAuth()
    const location = useLocation()
    const [events, setEvents] = useState([])
    const [shifts, setShifts] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [currentDate, setCurrentDate] = useState(new Date())
    const [loading, setLoading] = useState(true)

    // タブ管理: 'calendar' | 'propose' | 'vote'
    const [activeTab, setActiveTab] = useState(location.state?.tab || 'calendar')

    // 候補日入力用
    const [proposeDates, setProposeDates] = useState({})

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
    const toggleProposeTimeSlot = (dateStr, timeSlot) => {
        setProposeDates(prev => {
            const currentSlots = prev[dateStr] || []
            let newSlots
            if (currentSlots.includes(timeSlot)) {
                newSlots = currentSlots.filter(t => t !== timeSlot)
            } else {
                newSlots = [...currentSlots, timeSlot]
            }

            const newState = { ...prev }
            if (newSlots.length === 0) {
                delete newState[dateStr]
            } else {
                newState[dateStr] = newSlots
            }
            return newState
        })
    }

    const removeProposeDate = (dateStr) => {
        setProposeDates(prev => {
            const newState = { ...prev }
            delete newState[dateStr]
            return newState
        })
    }

    const handleSubmitCandidates = async () => {
        const dates = Object.keys(proposeDates)
        if (dates.length === 0) return
        try {
            for (const dateStr of dates) {
                const timeSlots = proposeDates[dateStr]
                for (const ts of timeSlots) {
                    const dateTime = ts === '24:00'
                        ? new Date(`${dateStr}T00:00`)
                        : new Date(`${dateStr}T${ts}`)
                    await addDoc(collection(db, 'events'), {
                        date: Timestamp.fromDate(dateTime),
                        timeSlot: ts,
                        memo: '',
                        status: 'candidate',
                        createdBy: user.uid
                    })
                }
            }
            setProposeDates({})
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
        const ev = events.find(e => e.id === eventId)
        const eventShifts = shifts.filter(s => s.eventId === eventId)
        const proposerAutoAvailable = ev?.createdBy && !eventShifts.find(s => s.userId === ev.createdBy)
        return {
            available: eventShifts.filter(s => s.status === 'available').length + (proposerAutoAvailable ? 1 : 0),
            unavailable: eventShifts.filter(s => s.status === 'unavailable').length,
            total: allUsers.length,
            responded: eventShifts.length + (proposerAutoAvailable ? 1 : 0),
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
        if (!window.confirm('この日程を開催確定にしますか？')) return
        try {
            const event = events.find(e => e.id === eventId)
            const snapshot = allUsers.map(u => ({
                userId: u.id,
                userName: u.displayName,
                status: (event?.createdBy === u.id && !shifts.find(s => s.eventId === eventId && s.userId === u.id))
                    ? 'available'
                    : shifts.find(s => s.eventId === eventId && s.userId === u.id)?.status || 'no_response'
            }))

            const batch = writeBatch(db)
            batch.update(doc(db, 'events', eventId), { status: 'confirmed', voteSnapshot: snapshot })

            const eventShifts = shifts.filter(s => s.eventId === eventId && s.status === 'available')
            for (const s of eventShifts) {
                batch.update(doc(db, 'shifts', s.id), { status: 'confirmed' })
            }
            // createdBy が未投票なら confirmed シフトとして追加
            if (event?.createdBy && !shifts.find(s => s.eventId === eventId && s.userId === event.createdBy)) {
                const newRef = doc(collection(db, 'shifts'))
                batch.set(newRef, { eventId, userId: event.createdBy, status: 'confirmed' })
            }
            await batch.commit()
            await loadData()
        } catch (error) {
            console.error('開催確定エラー:', error)
        }
    }

    const handleCancelEvent = async (eventId) => {
        if (!window.confirm('この日程を不開催にしますか？調整データは保存されます。')) return
        try {
            const event = events.find(e => e.id === eventId)
            const snapshot = allUsers.map(u => ({
                userId: u.id,
                userName: u.displayName,
                status: (event?.createdBy === u.id && !shifts.find(s => s.eventId === eventId && s.userId === u.id))
                    ? 'available'
                    : shifts.find(s => s.eventId === eventId && s.userId === u.id)?.status || 'no_response'
            }))
            await updateDoc(doc(db, 'events', eventId), { status: 'cancelled', voteSnapshot: snapshot })
            await loadData()
        } catch (error) {
            console.error('不開催更新エラー:', error)
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
            const storedDate = showEventDetail.date
            const baseDate = new Date(storedDate.getFullYear(), storedDate.getMonth(), storedDate.getDate())
            const newDateTime = editTimeSlot === '24:00'
                ? new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0)
                : new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(),
                    parseInt(editTimeSlot.split(':')[0]), parseInt(editTimeSlot.split(':')[1]), 0)
            await updateDoc(doc(db, 'events', showEventDetail.id), {
                timeSlot: editTimeSlot,
                date: Timestamp.fromDate(newDateTime),
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

    const handleRevertToCandidate = async (eventId) => {
        if (!window.confirm('このイベントを調整中（候補）に戻しますか？')) return
        try {
            const batch = writeBatch(db)
            batch.update(doc(db, 'events', eventId), { status: 'candidate', voteSnapshot: [] })
            const confirmedShifts = shifts.filter(s => s.eventId === eventId && s.status === 'confirmed')
            for (const s of confirmedShifts) {
                batch.update(doc(db, 'shifts', s.id), { status: 'available' })
            }
            await batch.commit()
            setShowEventDetail(null)
            await loadData()
        } catch (error) {
            console.error('候補に戻すエラー:', error)
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

                    {/* 不開催履歴 */}
                    {events.filter(e => e.status === 'cancelled').length > 0 && (
                        <div className="mt-lg">
                            <p className="text-sm text-muted mb-md">不開催履歴</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {events
                                    .filter(e => e.status === 'cancelled')
                                    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
                                    .map(ev => (
                                        <div
                                            key={ev.id}
                                            onClick={() => openEventDetail(ev)}
                                            style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '8px 12px', borderRadius: '6px',
                                                border: '1px solid var(--border-subtle)', cursor: 'pointer', opacity: 0.6
                                            }}
                                        >
                                            <span className="text-sm" style={{ textDecoration: 'line-through' }}>
                                                {formatFullDate(ev.date)} {ev.timeSlot}
                                            </span>
                                            <span className="badge" style={{ background: 'var(--bg-glass)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>不開催</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
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
                                    const selectedSlots = proposeDates[dateStr] || []
                                    const isSelected = selectedSlots.length > 0
                                    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
                                    const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

                                    return (
                                        <div
                                            key={day}
                                            className={`calendar-day ${isToday ? 'today' : ''} ${isPast ? 'other-month' : ''}`}
                                            style={{
                                                background: isSelected ? 'rgba(232, 67, 147, 0.05)' : undefined,
                                                cursor: 'default',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                padding: '4px'
                                            }}
                                        >
                                            <div className="calendar-day-number" style={{
                                                color: isSelected ? 'var(--accent-pink-light)' : undefined,
                                                fontWeight: isSelected ? '600' : undefined,
                                                alignSelf: 'flex-start',
                                                marginBottom: 'auto'
                                            }}>
                                                {day}
                                            </div>
                                            {!isPast && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', marginTop: '4px' }}>
                                                    {['21:00', '24:00'].map(ts => {
                                                        const isTsSelected = selectedSlots.includes(ts)
                                                        return (
                                                            <div
                                                                key={ts}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    toggleProposeTimeSlot(dateStr, ts)
                                                                }}
                                                                style={{
                                                                    border: `1.5px solid ${isTsSelected ? 'var(--accent-pink)' : 'var(--color-black)'}`,
                                                                    backgroundColor: isTsSelected ? 'rgba(232, 67, 147, 0.1)' : 'var(--bg-secondary)',
                                                                    color: isTsSelected ? 'var(--accent-pink)' : 'var(--text-tertiary)',
                                                                    borderRadius: '4px',
                                                                    padding: '2px 0',
                                                                    textAlign: 'center',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: isTsSelected ? 'bold' : 'normal',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >
                                                                {ts}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 選択済み候補日の表示 */}
                        {Object.keys(proposeDates).length > 0 && (
                            <div className="mt-lg">
                                <p className="text-sm text-muted mb-md">
                                    選択中の候補:
                                </p>
                                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                    {Object.keys(proposeDates).sort().map(d => (
                                        <span key={d} className="tag" style={{ cursor: 'pointer' }} onClick={() => removeProposeDate(d)}>
                                            {new Date(d).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })} ({proposeDates[d].join(', ')})
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
                        disabled={Object.keys(proposeDates).length === 0}
                    >
                        {Object.keys(proposeDates).length > 0
                            ? `候補日を提案する`
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
                                            .sort((a, b) => {
                                                const dateA = a.date ? new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate()).getTime() : 0;
                                                const dateB = b.date ? new Date(b.date.getFullYear(), b.date.getMonth(), b.date.getDate()).getTime() : 0;
                                                if (dateA !== dateB) return dateA - dateB;
                                                return (a.timeSlot || '').localeCompare(b.timeSlot || '');
                                            })
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
                                                            <span style={{
                                                                border: '1.5px solid var(--accent-pink)',
                                                                backgroundColor: 'rgba(232, 67, 147, 0.1)',
                                                                color: 'var(--accent-pink)',
                                                                borderRadius: '4px',
                                                                padding: '4px 16px',
                                                                textAlign: 'center',
                                                                fontSize: '0.9rem',
                                                                fontWeight: 'bold',
                                                                display: 'inline-block'
                                                            }}>{ev.timeSlot}</span>
                                                        </td>
                                                        {allUsers.map(u => {
                                                            const vote = shifts.find(s => s.eventId === ev.id && s.userId === u.id)
                                                            const isMe = u.id === user.uid
                                                            const isProposerAutoAvailable = u.id === ev.createdBy && !vote
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
                                                                    ) : isProposerAutoAvailable ? (
                                                                        <span title="提案者のため自動出席" style={{ fontSize: '1.2rem', color: 'var(--color-black)', opacity: 0.4 }}>○</span>
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
                                                            <div className="flex vote-action-buttons" style={{ justifyContent: 'center' }}>
                                                                <button
                                                                    className="btn btn-primary btn-sm"
                                                                    onClick={() => handleConfirmEvent(ev.id)}
                                                                    title="開催確定"
                                                                >
                                                                    開催
                                                                </button>
                                                                <button
                                                                    className="btn btn-secondary btn-sm"
                                                                    onClick={() => handleCancelEvent(ev.id)}
                                                                    title="不開催（データ保存）"
                                                                >
                                                                    不開催
                                                                </button>
                                                                <button
                                                                    className="btn btn-danger btn-sm"
                                                                    onClick={() => handleCancelCandidate(ev.id)}
                                                                    title="完全削除"
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
                                    <option value="21:00">21:00</option>
                                    <option value="24:00">24:00</option>
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
                                <span className={`badge ${showEventDetail.status === 'confirmed' ? 'badge-confirmed' : showEventDetail.status === 'cancelled' ? 'badge-posted' : 'badge-unwritten'}`}>
                                    {showEventDetail.status === 'confirmed' ? '開催確定' : showEventDetail.status === 'cancelled' ? '不開催' : '候補'}
                                </span>
                            </div>

                            {/* 出勤メンバー（確定後は現在の状態を表示） */}
                            <div className="mb-lg">
                                <p className="text-sm text-muted mb-md">
                                    {showEventDetail.status === 'confirmed' ? '出勤メンバー' : '調整時の回答状況'}
                                </p>
                                {showEventDetail.status === 'confirmed' ? (
                                    getShiftsForEvent(showEventDetail.id).length > 0 ? (
                                        getShiftsForEvent(showEventDetail.id).map(s => (
                                            <div key={s.id} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '8px 0', borderBottom: '1px solid var(--border-subtle)'
                                            }}>
                                                <span className="text-sm">{s.userName}</span>
                                                <span style={{
                                                    fontSize: '1.1rem',
                                                    color: (s.status === 'confirmed' || s.status === 'available') ? 'var(--color-black)' : s.status === 'unavailable' ? 'var(--color-dark-gray)' : 'var(--text-tertiary)'
                                                }}>
                                                    {(s.status === 'confirmed' || s.status === 'available') ? '○' : s.status === 'unavailable' ? '✕' : '—'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted">まだ回答がありません</p>
                                    )
                                ) : showEventDetail.voteSnapshot && showEventDetail.voteSnapshot.length > 0 ? (
                                    showEventDetail.voteSnapshot.map(v => (
                                        <div key={v.userId} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '8px 0', borderBottom: '1px solid var(--border-subtle)'
                                        }}>
                                            <span className="text-sm">{v.userName}</span>
                                            <span style={{
                                                fontSize: '1.1rem',
                                                color: v.status === 'available' ? 'var(--color-black)' : v.status === 'unavailable' ? 'var(--color-dark-gray)' : 'var(--text-tertiary)'
                                            }}>
                                                {v.status === 'available' ? '○' : v.status === 'unavailable' ? '✕' : '—'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    getShiftsForEvent(showEventDetail.id).length > 0 ? (
                                        getShiftsForEvent(showEventDetail.id).map(s => (
                                            <div key={s.id} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '8px 0', borderBottom: '1px solid var(--border-subtle)'
                                            }}>
                                                <span className="text-sm">{s.userName}</span>
                                                <span style={{
                                                    fontSize: '1.1rem',
                                                    color: s.status === 'available' ? 'var(--color-black)' : s.status === 'unavailable' ? 'var(--color-dark-gray)' : 'var(--text-tertiary)'
                                                }}>
                                                    {s.status === 'available' ? '○' : s.status === 'unavailable' ? '✕' : '—'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted">まだ回答がありません</p>
                                    )
                                )}
                            </div>

                            {/* 自分の出欠（候補・確定は変更可、不開催は非表示） */}
                            {(showEventDetail.status === 'candidate' || showEventDetail.status === 'confirmed') && (() => {
                                const myVote = getMyVote(showEventDetail.id)
                                const isAttending = myVote === 'available' || myVote === 'confirmed'
                                return (
                                    <div className="mb-lg">
                                        <p className="text-sm text-muted mb-md">あなたの出勤</p>
                                        <div className="flex gap-sm">
                                            <button
                                                className={`btn btn-sm ${isAttending ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => handleShiftUpdate(showEventDetail.id, 'available')}
                                            >
                                                ○ 出勤
                                            </button>
                                            <button
                                                className={`btn btn-sm ${myVote === 'unavailable' ? 'btn-danger' : 'btn-secondary'}`}
                                                onClick={() => handleShiftUpdate(showEventDetail.id, 'unavailable')}
                                            >
                                                ✕ 欠勤
                                            </button>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteEvent(showEventDetail.id)}>
                                削除
                            </button>
                            <div className="flex gap-sm">
                                {(showEventDetail.status === 'confirmed' || showEventDetail.status === 'cancelled') && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => handleRevertToCandidate(showEventDetail.id)}>
                                        候補に戻す
                                    </button>
                                )}
                                <button className="btn btn-primary btn-sm" onClick={handleUpdateEvent}>
                                    保存
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
