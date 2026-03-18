const FREQUENCY_LABELS = {
    daily: '毎日',
    weekly: '毎週',
    biweekly: '隔週',
    monthly: '毎月',
    specific_weekday: '特定週',
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function formatDatetime(timestamp) {
    if (!timestamp) return null
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    const weekday = WEEKDAY_LABELS[d.getDay()]
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}(${weekday}) ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDate(timestamp) {
    if (!timestamp) return null
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

function formatJoinMethod(event) {
    if (event.joinMethod === 'join') return 'Join'
    if (event.joinMethod === 'group') return 'Group'
    if (event.joinMethod === 'reqin') {
        return event.reqInLimit != null ? `ReqIn（${event.reqInLimit}回）` : 'ReqIn'
    }
    return event.joinMethod
}

function formatRecurringRule(rule) {
    if (!rule) return null
    const freq = FREQUENCY_LABELS[rule.frequency] || rule.frequency
    const days = rule.weekdays && rule.weekdays.length > 0
        ? rule.weekdays.sort((a, b) => a - b).map(d => WEEKDAY_LABELS[d]).join('・')
        : null
    return days ? `${freq}（${days}曜日）` : freq
}

export default function EventDetailModal({ event, managedUntil, onEdit, onDelete, onClose }) {
    const startStr = formatDatetime(event.startAt)
    const endStr = event.endAt ? formatDatetime(event.endAt) : null
    const joinStr = formatJoinMethod(event)
    const recurringStr = event.isRecurring ? formatRecurringRule(event.recurringRule) : null
    const managedUntilStr = managedUntil ? formatDate(managedUntil) : null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title" style={{ flex: 1, marginRight: '8px' }}>{event.title}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* 日時 */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '16px', minWidth: '20px' }}>◷</span>
                        <div>
                            <div style={{ fontSize: '14px' }}>{startStr}</div>
                            {endStr && <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>〜 {endStr}</div>}
                        </div>
                    </div>

                    {/* 参加方法 */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '16px', minWidth: '20px' }}>◈</span>
                        <div style={{ fontSize: '14px' }}>参加方法: <strong>{joinStr}</strong></div>
                    </div>

                    {/* 定期情報 */}
                    {recurringStr && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '16px', minWidth: '20px' }}>↻</span>
                            <div>
                                <div style={{ fontSize: '14px' }}>定期: <strong>{recurringStr}</strong></div>
                                {managedUntilStr && (
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        管理期間: {formatDate(event.startAt)} 〜 {managedUntilStr}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 備考 */}
                    {event.note && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '16px', minWidth: '20px' }}>✎</span>
                            <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{event.note}</div>
                        </div>
                    )}

                    {/* 公式X リンク */}
                    {event.xUrl && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ fontSize: '16px', minWidth: '20px' }}>✕</span>
                            <a
                                href={event.xUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: '14px', color: 'var(--accent-pink-light)', wordBreak: 'break-all' }}
                            >
                                {event.xUrl}
                            </a>
                        </div>
                    )}

                    {/* 登録者 */}
                    {event.createdByName && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ fontSize: '16px', minWidth: '20px' }}>♦</span>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>登録者: {event.createdByName}</div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>閉じる</button>
                    <button className="btn btn-secondary" onClick={onEdit}>編集</button>
                    <button className="btn btn-danger" onClick={onDelete}>削除</button>
                </div>
            </div>
        </div>
    )
}
