import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

export default function RecurringEditDialog({ mode, onSelect, onCancel }) {
    useBodyScrollLock(true)

    // mode: 'edit' | 'delete'
    const options = [
        { value: 'this', label: 'この回のみ変更' },
        { value: 'future', label: 'これ以降すべて変更' },
        { value: 'all', label: 'すべての回を変更' },
    ]

    if (mode === 'delete') {
        options[0].label = 'この回のみ削除'
        options[1].label = 'これ以降すべて削除'
        options[2].label = 'すべての回を削除'
    }

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">定期イベントの{mode === 'delete' ? '削除' : '変更'}</h2>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {options.map(opt => (
                            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <input type="radio" name="recurringScope" value={opt.value} style={{ accentColor: 'var(--accent-color)', width: '16px', height: '16px' }} />
                                <span style={{ fontSize: '14px' }}>{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onCancel}>キャンセル</button>
                    <button className="btn btn-primary" onClick={() => {
                        const selected = document.querySelector('input[name="recurringScope"]:checked')
                        if (selected) onSelect(selected.value)
                    }}>続ける</button>
                </div>
            </div>
        </div>
    )
}
