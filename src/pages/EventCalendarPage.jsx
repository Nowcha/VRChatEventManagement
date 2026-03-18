import { useState, useEffect } from 'react'
import {
    collection, query, orderBy, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, setDoc,
    serverTimestamp, Timestamp, writeBatch
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import EventCalendarModal from '../components/EventCalendarModal'
import EventDetailModal from '../components/EventDetailModal'
import RecurringEditDialog from '../components/RecurringEditDialog'

const JOIN_COLORS = {
    join:   { bg: 'rgba(79,142,247,0.18)', border: '#4f8ef7', text: '#4f8ef7' },
    reqin:  { bg: 'rgba(247,146,79,0.18)', border: '#f7924f', text: '#f7924f' },
    group:  { bg: 'rgba(79,207,122,0.18)', border: '#4fcf7a', text: '#4fcf7a' },
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']
const BASE_HOUR = 10  // 時間グリッド開始時
const END_HOUR  = 28  // 28=翌4:00
const HOUR_HEIGHT = 60 // px/hour

// 定期展開ロジック
function expandRecurringDates(baseDate, rule, managedUntil) {
    const dates = []
    const until = new Date(managedUntil)
    const { frequency, weekdays = [], endType, endDate, count } = rule
    let current = new Date(baseDate)
    let occurrences = 0
    const maxCount = endType === 'after' ? Number(count) : Infinity
    const maxDate = endType === 'on' && endDate ? new Date(endDate) : until

    while (current <= until && current <= maxDate && occurrences < maxCount) {
        if (['weekly', 'biweekly', 'specific_weekday'].includes(frequency)) {
            if (weekdays.includes(current.getDay())) {
                dates.push(new Date(current))
                occurrences++
            }
        } else {
            dates.push(new Date(current))
            occurrences++
        }

        switch (frequency) {
            case 'daily':
                current.setDate(current.getDate() + 1)
                break
            case 'weekly':
            case 'specific_weekday':
                current.setDate(current.getDate() + 1)
                break
            case 'biweekly': {
                current.setDate(current.getDate() + 1)
                // 同週のweekdaysが終わったら14日先の先頭曜日へジャンプ
                const recentInGroup = weekdays.some(d => d === current.getDay())
                if (!recentInGroup) {
                    const minWd = Math.min(...weekdays)
                    const jump = new Date(current)
                    // 次の隔週の minWd まで進む
                    let steps = 0
                    while (jump.getDay() !== minWd || steps < 7) {
                        jump.setDate(jump.getDate() + 1)
                        steps++
                    }
                    // さらに7日追加して隔週に
                    jump.setDate(jump.getDate() + 7)
                    current = jump
                }
                break
            }
            case 'monthly':
                current.setMonth(current.getMonth() + 1)
                break
            default:
                current.setDate(current.getDate() + 1)
        }
    }
    return dates
}

// 時刻表示
function fmtTime(ts) {
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 月の週開始日 (月曜始まりにする場合は調整)
function getMonthCells(year, month) {
    const first = new Date(year, month, 1)
    const last  = new Date(year, month + 1, 0)
    return { firstDay: first.getDay(), daysInMonth: last.getDate() }
}

// 週の月〜日を返す（日曜始まり）
function getWeekDays(base) {
    const day = base.getDay() // 0=Sun
    const sun = new Date(base)
    sun.setDate(base.getDate() - day)
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sun)
        d.setDate(sun.getDate() + i)
        return d
    })
}

// イベントのtop/height計算（時間グリッド用）
function calcEventPos(startAt, endAt) {
    const s = startAt?.toDate ? startAt.toDate() : new Date(startAt)
    let h = s.getHours()
    if (h < BASE_HOUR) h += 24  // midnight〜早朝を翌日扱い
    const top = (h - BASE_HOUR + s.getMinutes() / 60) * HOUR_HEIGHT
    let height = HOUR_HEIGHT / 2  // default 30min
    if (endAt) {
        const e = endAt?.toDate ? endAt.toDate() : new Date(endAt)
        let eh = e.getHours()
        if (eh < BASE_HOUR) eh += 24
        height = Math.max(HOUR_HEIGHT / 2, (eh + e.getMinutes() / 60 - h - s.getMinutes() / 60) * HOUR_HEIGHT)
    }
    return { top, height }
}

export default function EventCalendarPage() {
    const { user, userData } = useAuth()
    const [events, setEvents] = useState([])
    const [recurringGroups, setRecurringGroups] = useState({})
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState('month')          // 'month' | 'week' | 'day'
    const [currentDate, setCurrentDate] = useState(new Date())

    const [showRegisterModal, setShowRegisterModal] = useState(false)
    const [editingEvent, setEditingEvent] = useState(null)
    const [detailEvent, setDetailEvent] = useState(null)
    const [recurringDialog, setRecurringDialog] = useState(null)

    useEffect(() => {
        const q = query(collection(db, 'externalEvents'), orderBy('startAt', 'asc'))
        const unsub = onSnapshot(q, snap => {
            setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            setLoading(false)
        }, err => { console.error(err); setLoading(false) })
        return () => unsub()
    }, [])

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'recurringGroups'), snap => {
            const g = {}
            snap.docs.forEach(d => { g[d.id] = { id: d.id, ...d.data() } })
            setRecurringGroups(g)
        })
        return () => unsub()
    }, [])

    // ナビゲーション
    const navigate = (dir) => {
        const d = new Date(currentDate)
        if (view === 'month') d.setMonth(d.getMonth() + dir)
        else if (view === 'week') d.setDate(d.getDate() + dir * 7)
        else d.setDate(d.getDate() + dir)
        setCurrentDate(d)
    }

    const goToday = () => setCurrentDate(new Date())

    // タイトル
    const getTitle = () => {
        const y = currentDate.getFullYear()
        const m = currentDate.getMonth() + 1
        if (view === 'month') return `${y}年 ${m}月`
        if (view === 'week') {
            const days = getWeekDays(currentDate)
            const s = days[0], e = days[6]
            if (s.getMonth() === e.getMonth())
                return `${s.getFullYear()}年 ${s.getMonth() + 1}月 ${s.getDate()}日 〜 ${e.getDate()}日`
            return `${s.getFullYear()}年 ${s.getMonth() + 1}/${s.getDate()} 〜 ${e.getMonth() + 1}/${e.getDate()}`
        }
        return `${y}年 ${m}月 ${currentDate.getDate()}日（${DAY_NAMES[currentDate.getDay()]}）`
    }

    // 日付に合致するイベントを返す
    const eventsForDate = (date) => events.filter(ev => {
        const d = ev.startAt?.toDate ? ev.startAt.toDate() : new Date(ev.startAt)
        return d.getFullYear() === date.getFullYear() &&
               d.getMonth()    === date.getMonth() &&
               d.getDate()     === date.getDate()
    })

    function openDetail(ev) { setDetailEvent(ev) }

    // 登録
    async function saveNewEvent(data) {
        const docData = {
            ...data,
            startAt: Timestamp.fromDate(data.startAt),
            endAt: data.endAt ? Timestamp.fromDate(data.endAt) : null,
            createdBy: user.uid,
            createdByName: userData?.displayName || user.displayName || 'Unknown',
            createdAt: serverTimestamp(),
            isRecurring: false,
        }
        await addDoc(collection(db, 'externalEvents'), docData)
        setShowRegisterModal(false)
    }

    async function saveRecurringEvent(data) {
        const { recurringRule } = data
        const managedUntil = new Date(data.startAt)
        managedUntil.setFullYear(managedUntil.getFullYear() + 1)

        const groupRef = doc(collection(db, 'recurringGroups'))
        const groupId = groupRef.id
        await setDoc(groupRef, {
            rule: {
                ...recurringRule,
                endDate: recurringRule.endDate ? Timestamp.fromDate(recurringRule.endDate) : null,
            },
            baseEvent: {
                title: data.title, joinMethod: data.joinMethod,
                reqInLimit: data.reqInLimit, note: data.note,
                startTime: { hours: data.startAt.getHours(), minutes: data.startAt.getMinutes() },
                endTime: data.endAt ? { hours: data.endAt.getHours(), minutes: data.endAt.getMinutes() } : null,
            },
            managedUntil: Timestamp.fromDate(managedUntil),
            createdAt: serverTimestamp(),
        })

        const dates = expandRecurringDates(data.startAt, recurringRule, managedUntil)
        const batchSize = 490
        for (let i = 0; i < dates.length; i += batchSize) {
            const batch = writeBatch(db)
            dates.slice(i, i + batchSize).forEach(date => {
                const startAt = new Date(date)
                let endAt = null
                if (data.endAt) {
                    endAt = new Date(date)
                    endAt.setHours(data.endAt.getHours())
                    endAt.setMinutes(data.endAt.getMinutes())
                }
                const ref = doc(collection(db, 'externalEvents'))
                batch.set(ref, {
                    title: data.title,
                    startAt: Timestamp.fromDate(startAt),
                    endAt: endAt ? Timestamp.fromDate(endAt) : null,
                    joinMethod: data.joinMethod,
                    reqInLimit: data.reqInLimit,
                    note: data.note,
                    createdBy: user.uid,
                    createdByName: userData?.displayName || user.displayName || 'Unknown',
                    createdAt: serverTimestamp(),
                    isRecurring: true,
                    recurringId: groupId,
                    recurringRule: {
                        ...recurringRule,
                        endDate: recurringRule.endDate ? Timestamp.fromDate(recurringRule.endDate) : null,
                    },
                    isOverride: false,
                    overrideOf: null,
                })
            })
            await batch.commit()
        }
        setShowRegisterModal(false)
    }

    async function handleSaveNew(data) {
        if (data.isRecurring) await saveRecurringEvent(data)
        else await saveNewEvent(data)
    }

    // 編集
    function handleEditClick() {
        const ev = detailEvent
        setDetailEvent(null)
        if (ev.isRecurring) {
            setRecurringDialog({
                mode: 'edit', event: ev,
                onSelect: scope => { setRecurringDialog(null); setEditingEvent({ event: ev, scope }) },
            })
        } else {
            setEditingEvent({ event: ev, scope: 'this' })
        }
    }

    async function handleSaveEdit(data) {
        const { event, scope } = editingEvent
        if (!event.isRecurring || scope === 'this') {
            await updateDoc(doc(db, 'externalEvents', event.id), {
                title: data.title,
                startAt: Timestamp.fromDate(data.startAt),
                endAt: data.endAt ? Timestamp.fromDate(data.endAt) : null,
                joinMethod: data.joinMethod,
                reqInLimit: data.reqInLimit,
                note: data.note,
                isOverride: event.isRecurring,
            })
        } else {
            const targets = scope === 'future'
                ? events.filter(e => e.recurringId === event.recurringId &&
                    (e.startAt?.toDate?.()?.getTime() ?? 0) >= (event.startAt?.toDate?.()?.getTime() ?? 0))
                : events.filter(e => e.recurringId === event.recurringId)
            const batchSize = 490
            for (let i = 0; i < targets.length; i += batchSize) {
                const batch = writeBatch(db)
                targets.slice(i, i + batchSize).forEach(e => {
                    const orig = e.startAt.toDate()
                    const ns = new Date(orig)
                    ns.setHours(data.startAt.getHours()); ns.setMinutes(data.startAt.getMinutes())
                    const ne = data.endAt ? (() => {
                        const d = new Date(orig)
                        d.setHours(data.endAt.getHours()); d.setMinutes(data.endAt.getMinutes())
                        return Timestamp.fromDate(d)
                    })() : null
                    batch.update(doc(db, 'externalEvents', e.id), {
                        title: data.title, startAt: Timestamp.fromDate(ns),
                        endAt: ne, joinMethod: data.joinMethod,
                        reqInLimit: data.reqInLimit, note: data.note,
                    })
                })
                await batch.commit()
            }
        }
        setEditingEvent(null)
    }

    // 削除
    function handleDeleteClick() {
        const ev = detailEvent
        setDetailEvent(null)
        if (ev.isRecurring) {
            setRecurringDialog({
                mode: 'delete', event: ev,
                onSelect: async scope => { setRecurringDialog(null); await performDelete(ev, scope) },
            })
        } else {
            performDelete(ev, 'this')
        }
    }

    async function performDelete(event, scope) {
        if (scope === 'this') {
            await deleteDoc(doc(db, 'externalEvents', event.id))
        } else {
            const targets = scope === 'future'
                ? events.filter(e => e.recurringId === event.recurringId &&
                    (e.startAt?.toDate?.()?.getTime() ?? 0) >= (event.startAt?.toDate?.()?.getTime() ?? 0))
                : events.filter(e => e.recurringId === event.recurringId)
            const batchSize = 490
            for (let i = 0; i < targets.length; i += batchSize) {
                const batch = writeBatch(db)
                targets.slice(i, i + batchSize).forEach(e => batch.delete(doc(db, 'externalEvents', e.id)))
                await batch.commit()
            }
            if (scope === 'all' && event.recurringId) {
                await deleteDoc(doc(db, 'recurringGroups', event.recurringId))
            }
        }
    }

    const today = new Date()
    const year  = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const { firstDay, daysInMonth } = getMonthCells(year, month)
    const weekDays = getWeekDays(currentDate)

    const managedUntilForDetail = detailEvent?.recurringId
        ? recurringGroups[detailEvent.recurringId]?.managedUntil
        : null

    // ===== レンダリング =====
    return (
        <div className="fade-in">
            {/* ページヘッダー */}
            <div className="page-header" style={{ marginBottom: '16px' }}>
                <div className="flex items-center justify-between" style={{ width: '100%' }}>
                    <h1 className="page-title">イベントカレンダー</h1>
                    <button className="btn btn-primary" onClick={() => setShowRegisterModal(true)}>
                        ＋ 新規登録
                    </button>
                </div>
            </div>

            {/* カレンダー本体 */}
            <div className="calendar">
                {/* カレンダーヘッダー：ナビ + ビュー切替 */}
                <div className="calendar-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>◀</button>
                        <h3 className="calendar-title">{getTitle()}</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(1)}>▶</button>
                        <button className="btn btn-ghost btn-sm" onClick={goToday} style={{ marginLeft: '4px', fontSize: '12px' }}>今日</button>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                            { key: 'month', label: '月' },
                            { key: 'week',  label: '週' },
                            { key: 'day',   label: '日' },
                        ].map(v => (
                            <button
                                key={v.key}
                                className={`btn btn-sm ${view === v.key ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setView(v.key)}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="loading-spinner"><div className="spinner"></div></div>
                ) : (
                    <>
                        {/* ===== 月ビュー ===== */}
                        {view === 'month' && (
                            <div className="calendar-grid">
                                {DAY_NAMES.map(d => (
                                    <div key={d} className="calendar-day-header">{d}</div>
                                ))}
                                {Array.from({ length: firstDay }).map((_, i) => (
                                    <div key={`e${i}`} className="calendar-day other-month" />
                                ))}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1
                                    const date = new Date(year, month, day)
                                    const dayEvs = eventsForDate(date)
                                    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
                                    return (
                                        <div key={day} className={`calendar-day ${isToday ? 'today' : ''}`}>
                                            <div className="calendar-day-number">{day}</div>
                                            {dayEvs.map(ev => {
                                                const col = JOIN_COLORS[ev.joinMethod] || JOIN_COLORS.join
                                                return (
                                                    <div
                                                        key={ev.id}
                                                        onClick={() => openDetail(ev)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '3px',
                                                            padding: '2px 5px', marginBottom: '2px',
                                                            background: col.bg,
                                                            border: `1px solid ${col.border}`,
                                                            borderRadius: '4px',
                                                            fontSize: '0.65rem', cursor: 'pointer',
                                                            color: col.text, fontWeight: '600',
                                                            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                                                        }}
                                                    >
                                                        {fmtTime(ev.startAt)} {ev.title}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* ===== 週ビュー ===== */}
                        {view === 'week' && (
                            <TimeGrid days={weekDays} events={events} onEventClick={openDetail} />
                        )}

                        {/* ===== 日ビュー ===== */}
                        {view === 'day' && (
                            <TimeGrid days={[currentDate]} events={events} onEventClick={openDetail} />
                        )}
                    </>
                )}
            </div>

            {/* モーダル類 */}
            {showRegisterModal && (
                <EventCalendarModal onSave={handleSaveNew} onCancel={() => setShowRegisterModal(false)} />
            )}
            {editingEvent && (
                <EventCalendarModal
                    initialData={editingEvent.event}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditingEvent(null)}
                />
            )}
            {detailEvent && (
                <EventDetailModal
                    event={detailEvent}
                    managedUntil={managedUntilForDetail}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                    onClose={() => setDetailEvent(null)}
                />
            )}
            {recurringDialog && (
                <RecurringEditDialog
                    mode={recurringDialog.mode}
                    onSelect={recurringDialog.onSelect}
                    onCancel={() => setRecurringDialog(null)}
                />
            )}
        </div>
    )
}

// 同一日のイベントを並列レイアウトに計算する
function layoutDayEvents(dayEvs) {
    if (dayEvs.length === 0) return []

    const getMs = ev => ev.startAt?.toDate ? ev.startAt.toDate().getTime() : new Date(ev.startAt).getTime()
    const getEndMs = ev => {
        if (ev.endAt) return ev.endAt?.toDate ? ev.endAt.toDate().getTime() : new Date(ev.endAt).getTime()
        return getMs(ev) + 30 * 60 * 1000
    }

    const sorted = [...dayEvs].sort((a, b) => getMs(a) - getMs(b))

    // 各イベントにグリッド列を貪欲に割り当て
    const colEnds = [] // 各列の最終終了時刻
    const assignments = sorted.map(ev => {
        const s = getMs(ev)
        const e = getEndMs(ev)
        let col = colEnds.findIndex(endTime => endTime <= s)
        if (col === -1) { col = colEnds.length; colEnds.push(e) }
        else colEnds[col] = e
        return { ev, col }
    })

    // 各イベントの totalCols = 自分と重なる全イベントの最大 (col+1)
    return assignments.map(item => {
        const s = getMs(item.ev)
        const e = getEndMs(item.ev)
        const overlapping = assignments.filter(o => getMs(o.ev) < e && getEndMs(o.ev) > s)
        const totalCols = Math.max(...overlapping.map(o => o.col + 1))
        return { ev: item.ev, col: item.col, totalCols }
    })
}

// ===== 時間グリッドコンポーネント（週/日共通） =====
function TimeGrid({ days, events, onEventClick }) {
    const hours = Array.from({ length: END_HOUR - BASE_HOUR }, (_, i) => BASE_HOUR + i)
    const isWeek = days.length === 7
    const today = new Date()

    const eventsForDay = (date) => events.filter(ev => {
        const d = ev.startAt?.toDate ? ev.startAt.toDate() : new Date(ev.startAt)
        return d.getFullYear() === date.getFullYear() &&
               d.getMonth()    === date.getMonth() &&
               d.getDate()     === date.getDate()
    })

    const isToday = (d) =>
        d.getFullYear() === today.getFullYear() &&
        d.getMonth()    === today.getMonth() &&
        d.getDate()     === today.getDate()

    const cols = `56px repeat(${days.length}, 1fr)`

    return (
        <div style={{ overflowX: 'auto', maxHeight: '680px', overflowY: 'auto' }}>
            {/* 曜日ヘッダー（sticky） */}
            <div style={{
                display: 'grid', gridTemplateColumns: cols,
                borderBottom: '1px solid var(--border-subtle)',
                position: 'sticky', top: 0, zIndex: 2,
                background: 'var(--bg-card)',
            }}>
                <div style={{ padding: '8px' }} />
                {days.map((d, i) => (
                    <div
                        key={i}
                        style={{
                            padding: '8px 4px', textAlign: 'center', fontSize: '0.75rem',
                            fontWeight: 'var(--font-weight-medium)', color: 'var(--text-tertiary)',
                            borderLeft: '1px solid var(--border-subtle)',
                            background: isToday(d) ? 'rgba(232,67,147,0.05)' : 'var(--bg-card)',
                        }}
                    >
                        <div style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {DAY_NAMES[d.getDay()]}
                        </div>
                        <div style={{
                            fontSize: '1.1rem',
                            color: isToday(d) ? 'var(--accent-pink-light)' : 'var(--text-secondary)',
                            fontWeight: isToday(d) ? 'var(--font-weight-medium)' : 'normal',
                        }}>
                            {d.getDate()}
                        </div>
                    </div>
                ))}
            </div>

            {/* 時間グリッド（ヘッダーと同一コンテナ内） */}
            <div style={{ display: 'grid', gridTemplateColumns: cols, position: 'relative' }}>
                {/* 時刻軸 */}
                <div style={{ position: 'relative' }}>
                    {hours.map(h => (
                        <div key={h} style={{
                            height: `${HOUR_HEIGHT}px`, borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex', alignItems: 'flex-start', paddingTop: '2px',
                            paddingRight: '6px', justifyContent: 'flex-end',
                            fontSize: '0.65rem', color: 'var(--text-tertiary)',
                        }}>
                            {h < 24 ? `${String(h).padStart(2, '0')}:00` : `${String(h - 24).padStart(2, '0')}:00`}
                        </div>
                    ))}
                </div>

                {/* 各日カラム */}
                {days.map((day, di) => {
                    const dayEvs = eventsForDay(day)
                    return (
                        <div
                            key={di}
                            style={{
                                position: 'relative',
                                borderLeft: '1px solid var(--border-subtle)',
                                background: isToday(day) ? 'rgba(232,67,147,0.02)' : 'transparent',
                            }}
                        >
                            {/* 時間グリッド線 */}
                            {hours.map(h => (
                                <div key={h} style={{
                                    height: `${HOUR_HEIGHT}px`,
                                    borderBottom: '1px solid var(--border-subtle)',
                                }} />
                            ))}
                            {/* イベントブロック（重複時は並列配置） */}
                            {layoutDayEvents(dayEvs).map(({ ev, col, totalCols }) => {
                                const { top, height } = calcEventPos(ev.startAt, ev.endAt)
                                const color = JOIN_COLORS[ev.joinMethod] || JOIN_COLORS.join
                                const inRange = top >= 0 && top < (END_HOUR - BASE_HOUR) * HOUR_HEIGHT
                                if (!inRange) return null
                                const leftPct  = (col / totalCols) * 100
                                const widthPct = (1 / totalCols) * 100
                                return (
                                    <div
                                        key={ev.id}
                                        onClick={() => onEventClick(ev)}
                                        style={{
                                            position: 'absolute',
                                            top: `${top}px`,
                                            left: `calc(${leftPct}% + 2px)`,
                                            width: `calc(${widthPct}% - 4px)`,
                                            height: `${height}px`, minHeight: '22px',
                                            background: color.bg,
                                            border: `1px solid ${color.border}`,
                                            borderLeft: `3px solid ${color.border}`,
                                            borderRadius: '4px',
                                            padding: '2px 4px', cursor: 'pointer',
                                            overflow: 'hidden', zIndex: 1,
                                            transition: 'opacity 0.15s',
                                            boxSizing: 'border-box',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                    >
                                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: color.text, lineHeight: 1.2 }}>
                                            {fmtTime(ev.startAt)}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {ev.title}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
