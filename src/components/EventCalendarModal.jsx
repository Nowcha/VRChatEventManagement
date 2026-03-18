import { useState, useEffect } from 'react'

const WEEKDAYS = [
    { value: 0, label: '日' },
    { value: 1, label: '月' },
    { value: 2, label: '火' },
    { value: 3, label: '水' },
    { value: 4, label: '木' },
    { value: 5, label: '金' },
    { value: 6, label: '土' },
]

const FREQUENCY_OPTIONS = [
    { value: 'daily', label: '日次' },
    { value: 'weekly', label: '週次' },
    { value: 'biweekly', label: '隔週' },
    { value: 'monthly', label: '月次' },
    { value: 'specific_weekday', label: '特定週' },
]

function toDatetimeLocal(timestamp) {
    if (!timestamp) return ''
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55']

// 日付・時・分を個別 select にした日時ピッカー（末端でループしない）
function DateTimePicker({ value, onChange }) {
    const [date, setDate] = useState('')
    const [hour, setHour] = useState('')
    const [minute, setMinute] = useState('')

    useEffect(() => {
        if (value && value.includes('T')) {
            const [d, t] = value.split('T')
            const [h, m] = t.split(':')
            setDate(d)
            setHour(h)
            // 5分単位に丸める（編集時に既存値が合わない場合の対処）
            const nearestM = MINUTES.reduce((prev, cur) =>
                Math.abs(Number(cur) - Number(m)) < Math.abs(Number(prev) - Number(m)) ? cur : prev
            )
            setMinute(nearestM)
        } else {
            setDate(''); setHour(''); setMinute('')
        }
    }, [value])

    function emit(d, h, m) {
        if (d && h !== '' && m !== '') onChange(`${d}T${h}:${m}`)
        else onChange('')
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <input
                type="date"
                className="form-input"
                value={date}
                onChange={e => { setDate(e.target.value); emit(e.target.value, hour, minute) }}
            />
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <select
                    className="form-input"
                    style={{ flex: 1 }}
                    value={hour}
                    onChange={e => { setHour(e.target.value); emit(date, e.target.value, minute) }}
                >
                    <option value="">時</option>
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>:</span>
                <select
                    className="form-input"
                    style={{ flex: 1 }}
                    value={minute}
                    onChange={e => { setMinute(e.target.value); emit(date, hour, e.target.value) }}
                >
                    <option value="">分</option>
                    {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
        </div>
    )
}

const emptyForm = () => ({
    title: '',
    startAt: '',
    endAt: '',
    joinMethod: 'join',
    reqInLimit: '',
    note: '',
    xUrl: '',
    isRecurring: false,
    recurringRule: {
        frequency: 'weekly',
        weekdays: [],
        endType: 'never',
        endDate: '',
        count: '',
    },
})

export default function EventCalendarModal({ initialData, onSave, onCancel }) {
    const [form, setForm] = useState(() => {
        if (!initialData) return emptyForm()
        return {
            title: initialData.title || '',
            startAt: toDatetimeLocal(initialData.startAt),
            endAt: initialData.endAt ? toDatetimeLocal(initialData.endAt) : '',
            joinMethod: initialData.joinMethod || 'join',
            reqInLimit: initialData.reqInLimit ?? '',
            note: initialData.note || '',
            xUrl: initialData.xUrl || '',
            isRecurring: initialData.isRecurring || false,
            recurringRule: initialData.recurringRule ? {
                frequency: initialData.recurringRule.frequency || 'weekly',
                weekdays: initialData.recurringRule.weekdays || [],
                endType: initialData.recurringRule.endType || 'never',
                endDate: initialData.recurringRule.endDate
                    ? (initialData.recurringRule.endDate.toDate
                        ? initialData.recurringRule.endDate.toDate().toISOString().slice(0, 10)
                        : new Date(initialData.recurringRule.endDate).toISOString().slice(0, 10))
                    : '',
                count: initialData.recurringRule.count ?? '',
            } : emptyForm().recurringRule,
        }
    })
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState({})

    const isEditing = !!initialData

    function setField(key, value) {
        setForm(f => ({ ...f, [key]: value }))
    }

    function setRuleField(key, value) {
        setForm(f => ({ ...f, recurringRule: { ...f.recurringRule, [key]: value } }))
    }

    function toggleWeekday(day) {
        const current = form.recurringRule.weekdays
        const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day]
        setRuleField('weekdays', next)
    }

    function validate() {
        const e = {}
        if (!form.title.trim()) e.title = 'イベント名は必須です'
        if (!form.startAt) e.startAt = '開始日時は必須です'
        if (form.endAt && form.startAt && form.endAt <= form.startAt) e.endAt = '終了日時は開始日時より後にしてください'
        if (form.isRecurring) {
            const needsWeekdays = ['weekly', 'biweekly', 'specific_weekday'].includes(form.recurringRule.frequency)
            if (needsWeekdays && form.recurringRule.weekdays.length === 0) e.weekdays = '曜日を1つ以上選択してください'
            if (form.recurringRule.endType === 'on' && !form.recurringRule.endDate) e.endDate = '終了日を指定してください'
            if (form.recurringRule.endType === 'after' && !form.recurringRule.count) e.count = '回数を入力してください'
        }
        return e
    }

    async function handleSubmit(e) {
        e.preventDefault()
        const e2 = validate()
        if (Object.keys(e2).length > 0) { setErrors(e2); return }
        setSaving(true)
        try {
            const data = {
                title: form.title.trim(),
                startAt: new Date(form.startAt),
                endAt: form.endAt ? new Date(form.endAt) : null,
                joinMethod: form.joinMethod,
                reqInLimit: form.joinMethod === 'reqin' && form.reqInLimit !== '' ? Number(form.reqInLimit) : null,
                note: form.note.trim(),
                xUrl: form.xUrl.trim(),
                isRecurring: form.isRecurring,
            }
            if (form.isRecurring) {
                data.recurringRule = {
                    frequency: form.recurringRule.frequency,
                    weekdays: form.recurringRule.weekdays,
                    endType: form.recurringRule.endType,
                    endDate: form.recurringRule.endType === 'on' ? new Date(form.recurringRule.endDate) : null,
                    count: form.recurringRule.endType === 'after' ? Number(form.recurringRule.count) : null,
                }
            }
            await onSave(data)
        } finally {
            setSaving(false)
        }
    }

    const showWeekdays = ['weekly', 'biweekly', 'specific_weekday'].includes(form.recurringRule.frequency)

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{isEditing ? 'イベント編集' : 'イベント登録'}</h2>
                    <button className="modal-close" onClick={onCancel}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* イベント名 */}
                        <div className="form-group">
                            <label className="form-label">イベント名 <span style={{ color: 'var(--accent-pink)' }}>*</span></label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.title}
                                onChange={e => setField('title', e.target.value)}
                                placeholder="例: ABCイベント"
                            />
                            {errors.title && <span className="form-error">{errors.title}</span>}
                        </div>

                        {/* 開始・終了日時 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                                <label className="form-label">開始日時 <span style={{ color: 'var(--accent-pink)' }}>*</span></label>
                                <DateTimePicker value={form.startAt} onChange={v => setField('startAt', v)} />
                                {errors.startAt && <span className="form-error">{errors.startAt}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">終了日時 <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>（任意）</span></label>
                                <DateTimePicker value={form.endAt} onChange={v => setField('endAt', v)} />
                                {errors.endAt && <span className="form-error">{errors.endAt}</span>}
                            </div>
                        </div>

                        {/* 参加方法 */}
                        <div className="form-group">
                            <label className="form-label">参加方法 <span style={{ color: 'var(--accent-pink)' }}>*</span></label>
                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                {['join', 'reqin', 'group'].map(method => (
                                    <label key={method} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="joinMethod"
                                            value={method}
                                            checked={form.joinMethod === method}
                                            onChange={() => setField('joinMethod', method)}
                                            style={{ accentColor: 'var(--accent-pink)' }}
                                        />
                                        <span style={{ fontSize: '14px' }}>{method === 'join' ? 'Join' : method === 'reqin' ? 'ReqIn' : 'Group'}</span>
                                    </label>
                                ))}
                            </div>
                            {form.joinMethod === 'reqin' && (
                                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ReqIn回数:</span>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="1"
                                        value={form.reqInLimit}
                                        onChange={e => setField('reqInLimit', e.target.value)}
                                        placeholder="未入力=制限なし"
                                        style={{ width: '140px' }}
                                    />
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>回</span>
                                </div>
                            )}
                        </div>

                        {/* 備考 */}
                        <div className="form-group">
                            <label className="form-label">備考 <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>（任意）</span></label>
                            <textarea
                                className="form-input"
                                rows={3}
                                value={form.note}
                                onChange={e => setField('note', e.target.value)}
                                placeholder="開催場所・補足情報など"
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        {/* 公式X リンク */}
                        <div className="form-group">
                            <label className="form-label">公式X リンク <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>（任意）</span></label>
                            <input
                                className="form-input"
                                type="url"
                                value={form.xUrl}
                                onChange={e => setField('xUrl', e.target.value)}
                                placeholder="https://x.com/..."
                            />
                        </div>

                        {/* 定期設定 */}
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                            <div
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', cursor: 'pointer' }}
                                onClick={() => setField('isRecurring', !form.isRecurring)}
                            >
                                <span style={{ fontWeight: '600', fontSize: '14px' }}>定期設定</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', color: form.isRecurring ? 'var(--accent-pink)' : 'var(--text-muted)' }}>
                                        {form.isRecurring ? 'ON' : 'OFF'}
                                    </span>
                                    <div style={{
                                        width: '40px', height: '22px', borderRadius: '11px',
                                        background: form.isRecurring ? 'var(--accent-pink)' : 'var(--border-color)',
                                        position: 'relative', transition: 'background 0.2s'
                                    }}>
                                        <div style={{
                                            width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                                            position: 'absolute', top: '3px',
                                            left: form.isRecurring ? '21px' : '3px', transition: 'left 0.2s'
                                        }} />
                                    </div>
                                </div>
                            </div>

                            {form.isRecurring && (
                                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {/* 頻度 */}
                                    <div className="form-group">
                                        <label className="form-label">頻度</label>
                                        <select
                                            className="form-input"
                                            value={form.recurringRule.frequency}
                                            onChange={e => setRuleField('frequency', e.target.value)}
                                        >
                                            {FREQUENCY_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* 曜日 */}
                                    {showWeekdays && (
                                        <div className="form-group">
                                            <label className="form-label">曜日</label>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {WEEKDAYS.map(d => {
                                                    const selected = form.recurringRule.weekdays.includes(d.value)
                                                    return (
                                                        <button
                                                            key={d.value}
                                                            type="button"
                                                            onClick={() => toggleWeekday(d.value)}
                                                            style={{
                                                                width: '36px', height: '36px', borderRadius: '6px',
                                                                border: `2px solid ${selected ? 'var(--accent-pink)' : '#aaa'}`,
                                                                background: selected ? 'var(--accent-pink)' : '#fff',
                                                                color: selected ? '#fff' : '#333',
                                                                fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                                                transition: 'all 0.15s'
                                                            }}
                                                        >
                                                            {d.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            {errors.weekdays && <span className="form-error">{errors.weekdays}</span>}
                                        </div>
                                    )}

                                    {/* 終了条件 */}
                                    <div className="form-group">
                                        <label className="form-label">終了条件</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {[
                                                { value: 'never', label: '終了なし（1年分生成）' },
                                                { value: 'on', label: '日付指定' },
                                                { value: 'after', label: '回数指定' },
                                            ].map(opt => (
                                                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input
                                                        type="radio"
                                                        name="endType"
                                                        value={opt.value}
                                                        checked={form.recurringRule.endType === opt.value}
                                                        onChange={() => setRuleField('endType', opt.value)}
                                                        style={{ accentColor: 'var(--accent-pink)' }}
                                                    />
                                                    <span style={{ fontSize: '14px' }}>{opt.label}</span>
                                                    {opt.value === 'on' && form.recurringRule.endType === 'on' && (
                                                        <input
                                                            className="form-input"
                                                            type="date"
                                                            value={form.recurringRule.endDate}
                                                            onChange={e => setRuleField('endDate', e.target.value)}
                                                            style={{ width: '150px', marginLeft: '8px' }}
                                                        />
                                                    )}
                                                    {opt.value === 'after' && form.recurringRule.endType === 'after' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                                                            <input
                                                                className="form-input"
                                                                type="number"
                                                                min="1"
                                                                value={form.recurringRule.count}
                                                                onChange={e => setRuleField('count', e.target.value)}
                                                                style={{ width: '70px' }}
                                                            />
                                                            <span style={{ fontSize: '13px' }}>回</span>
                                                        </div>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                        {errors.endDate && <span className="form-error">{errors.endDate}</span>}
                                        {errors.count && <span className="form-error">{errors.count}</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onCancel}>キャンセル</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? '保存中...' : isEditing ? '保存する' : '登録する'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
