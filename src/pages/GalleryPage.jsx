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
        if (files.length === 0 || !selectedEventId) return

        setUploading(true)
        try {
            for (const file of files) {
                const timestamp = Date.now()
                const storageRef = ref(storage, `gallery/${selectedEventId}/${timestamp}_${file.name}`)
                await uploadBytes(storageRef, file)
                const url = await getDownloadURL(storageRef)

                await addDoc(collection(db, 'photos'), {
                    eventId: selectedEventId,
                    imageUrl: url,
                    storagePath: `gallery/${selectedEventId}/${timestamp}_${file.name}`,
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

    const getEventTitle = (id) => {
        const ev = events.find(e => e.id === id)
        if (!ev) return '不明'
        const d = ev.date
        if (!d) return '不明'
        return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${ev.timeSlot || ''}回`
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

    // イベントごとにグルーピング
    const groupedPhotos = {}
    filteredPhotos.forEach(p => {
        const key = p.eventId
        if (!groupedPhotos[key]) groupedPhotos[key] = []
        groupedPhotos[key].push(p)
    })

    if (loading) {
        return <div className="loading-spinner"><div className="spinner"></div></div>
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="page-title">ギャラリー</h1>
                        <p className="page-subtitle">イベントの集合写真</p>
                    </div>
                </div>
            </div>

            {/* アップロード・フィルタ */}
            <div className="flex gap-md mb-lg" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: '200px' }}
                    value={selectedEventId}
                    onChange={e => setSelectedEventId(e.target.value)}
                >
                    <option value="">すべてのイベント</option>
                    {events.map(ev => (
                        <option key={ev.id} value={ev.id}>
                            {getEventTitle(ev.id)}
                        </option>
                    ))}
                </select>

                {selectedEventId && (
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

            {/* ギャラリー表示 */}
            {Object.keys(groupedPhotos).length > 0 ? (
                Object.entries(groupedPhotos).map(([eventId, eventPhotos]) => (
                    <div key={eventId} className="mb-lg">
                        <h3 style={{
                            fontFamily: 'var(--font-serif)',
                            marginBottom: '16px',
                            color: 'var(--text-secondary)',
                            fontSize: '1rem'
                        }}>
                            {getEventTitle(eventId)}
                            <span className="text-xs text-muted" style={{ marginLeft: '12px' }}>
                                {eventPhotos.length}枚
                            </span>
                        </h3>
                        <div className="gallery-grid">
                            {eventPhotos.map(photo => (
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
