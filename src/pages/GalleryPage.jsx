import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, addDoc, deleteDoc, doc, where } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function GalleryPage() {
    const { user } = useAuth()
    const [events, setEvents] = useState([])
    const [photos, setPhotos] = useState([])
    const [selectedEventId, setSelectedEventId] = useState('')
    const [isManualUploadEvent, setIsManualUploadEvent] = useState(false)
    const [manualDateInput, setManualDateInput] = useState(new Date().toISOString().split('T')[0])
    const [manualTimeSlotInput, setManualTimeSlotInput] = useState('21:00')
    const [lightboxImage, setLightboxImage] = useState(null)
    const [uploading, setUploading] = useState(false)
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

            // 写真
            const photosSnap = await getDocs(query(collection(db, 'photos'), orderBy('uploadedAt', 'desc')))
            setPhotos(photosSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                uploadedAt: d.data().uploadedAt?.toDate()
            })))
        } catch (error) {
            console.error('データ取得エラー:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files)
        const effectiveEventId = isManualUploadEvent ? '' : selectedEventId

        let effectiveManualInput = ''
        if (isManualUploadEvent && manualDateInput && manualTimeSlotInput) {
            const [y, m, d] = manualDateInput.split('-')
            effectiveManualInput = `${y}年${m}月${d}日 ${manualTimeSlotInput}`
        }

        if (files.length === 0 || (!effectiveEventId && !effectiveManualInput)) return

        setUploading(true)
        try {
            const folderName = effectiveEventId || 'manual'
            for (const file of files) {
                const timestamp = Date.now()
                const storageRef = ref(storage, `gallery/${folderName}/${timestamp}_${file.name}`)
                await uploadBytes(storageRef, file)
                const url = await getDownloadURL(storageRef)

                await addDoc(collection(db, 'photos'), {
                    eventId: effectiveEventId,
                    eventManualInput: effectiveManualInput,
                    imageUrl: url,
                    storagePath: `gallery/${folderName}/${timestamp}_${file.name}`,
                    uploadedBy: user.uid,
                    uploadedAt: new Date()
                })
            }
            loadData()
        } catch (error) {
            console.error('アップロードエラー:', error)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (photo) => {
        if (!window.confirm('この写真を削除しますか？')) return
        try {
            if (photo.storagePath) {
                const storageRef = ref(storage, photo.storagePath)
                await deleteObject(storageRef).catch(() => { }) // Storage削除失敗は無視
            }
            await deleteDoc(doc(db, 'photos', photo.id))
            setLightboxImage(null)
            loadData()
        } catch (error) {
            console.error('削除エラー:', error)
        }
    }

    const confirmedEvents = events.filter(e => e.status === 'confirmed')

    const getEventTitle = (id, manualInput) => {
        if (!id && manualInput) return manualInput
        const ev = events.find(e => e.id === id)
        if (!ev) return '不明'
        const d = ev.date
        if (!d) return '不明'
        return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${ev.timeSlot || ''}`
    }

    const formatDate = (date) => {
        if (!date) return '-'
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric', month: 'short', day: 'numeric'
        }).format(date instanceof Date ? date : new Date(date))
    }

    // イベントでフィルタリング
    const filteredPhotos = selectedEventId
        ? photos.filter(p => p.eventId === selectedEventId)
        : photos

    // イベントごとにグルーピング（手入力イベントも含む）
    const groupedPhotos = {}
    filteredPhotos.forEach(p => {
        const key = p.eventId || `manual:${p.eventManualInput || '不明'}`
        if (!groupedPhotos[key]) groupedPhotos[key] = { photos: [], manualInput: p.eventManualInput || '' }
        groupedPhotos[key].photos.push(p)
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
                            <h1 className="page-title">ギャラリー</h1>
                            <p className="page-subtitle">イベントの集合写真</p>
                        </div>
                    </div>
                </div>

                {/* アップロード・フィルタ */}
                <div className="flex gap-md" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    checked={!isManualUploadEvent}
                                    onChange={() => { setIsManualUploadEvent(false); setManualDateInput(new Date().toISOString().split('T')[0]); setManualTimeSlotInput('21:00') }}
                                    style={{ accentColor: 'var(--accent-pink)' }}
                                />
                                <span className="text-sm">一覧から選択</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    checked={isManualUploadEvent}
                                    onChange={() => { setIsManualUploadEvent(true); setSelectedEventId('') }}
                                    style={{ accentColor: 'var(--accent-pink)' }}
                                />
                                <span className="text-sm">手入力する</span>
                            </label>
                        </div>
                        {!isManualUploadEvent ? (
                            <select
                                className="form-select"
                                style={{ width: 'auto', minWidth: '200px' }}
                                value={selectedEventId}
                                onChange={e => setSelectedEventId(e.target.value)}
                            >
                                <option value="">すべてのイベント</option>
                                {confirmedEvents.map(ev => (
                                    <option key={ev.id} value={ev.id}>
                                        {getEventTitle(ev.id)}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="flex gap-sm">
                                <input
                                    type="date"
                                    className="form-input"
                                    value={manualDateInput}
                                    onChange={e => setManualDateInput(e.target.value)}
                                    style={{ minWidth: '150px' }}
                                />
                                <select
                                    className="form-select"
                                    value={manualTimeSlotInput}
                                    onChange={e => setManualTimeSlotInput(e.target.value)}
                                    style={{ width: '120px' }}
                                >
                                    <option value="21:00">21:00</option>
                                    <option value="24:00">24:00</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {(selectedEventId || (isManualUploadEvent && manualDateInput && manualTimeSlotInput)) && (
                        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                            {uploading ? 'アップロード中...' : '📷 写真をアップロード'}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleUpload}
                                disabled={uploading}
                                style={{ display: 'none' }}
                            />
                        </label>
                    )}
                </div>
            </div>

            {/* ギャラリー表示 */}
            {Object.keys(groupedPhotos).length > 0 ? (
                Object.entries(groupedPhotos).map(([eventId, group]) => (
                    <div key={eventId} className="mb-lg">
                        <h3 style={{
                            fontFamily: 'var(--font-serif)',
                            marginBottom: '16px',
                            color: 'var(--text-secondary)',
                            fontSize: '1rem'
                        }}>
                            {getEventTitle(eventId.startsWith('manual:') ? '' : eventId, group.manualInput)}
                            <span className="text-xs text-muted" style={{ marginLeft: '12px' }}>
                                {group.photos.length}枚
                            </span>
                        </h3>
                        <div className="gallery-grid">
                            {group.photos.map(photo => (
                                <div
                                    key={photo.id}
                                    className="gallery-item"
                                    onClick={() => setLightboxImage(photo)}
                                >
                                    <img src={photo.imageUrl} alt="イベント写真" loading="lazy" />
                                    <div className="gallery-item-overlay">
                                        <span className="text-xs">{formatDate(photo.uploadedAt)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">◫</div>
                    <p className="empty-state-text">写真がありません</p>
                    {!selectedEventId && (
                        <p className="text-sm text-muted">イベントを選択して写真をアップロードしてください</p>
                    )}
                </div>
            )}

            {/* ライトボックス */}
            {lightboxImage && (
                <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                        <img
                            src={lightboxImage.imageUrl}
                            alt="拡大表示"
                            className="lightbox-image"
                        />
                        <div style={{
                            position: 'absolute',
                            top: '-40px',
                            right: '0',
                            display: 'flex',
                            gap: '8px'
                        }}>
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDelete(lightboxImage)}
                            >
                                削除
                            </button>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setLightboxImage(null)}
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
