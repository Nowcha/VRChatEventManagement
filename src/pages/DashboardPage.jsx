import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function DashboardPage() {
    const { userData } = useAuth()
    const [stats, setStats] = useState({
        upcomingEvents: 0,
        totalCustomers: 0,
        pendingFeedbacks: 0,
        totalPhotos: 0
    })
    const [nextEvent, setNextEvent] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadDashboardData()
    }, [])

    const loadDashboardData = async () => {
        try {
            // 統計情報の取得
            const now = Timestamp.now()

            // 今後のイベント数
            const eventsQuery = query(
                collection(db, 'events'),
                where('date', '>=', now),
                orderBy('date', 'asc')
            )
            const eventsSnapshot = await getDocs(eventsQuery)
            const upcomingEvents = eventsSnapshot.docs

            // 顧客数
            const customersSnapshot = await getDocs(collection(db, 'customers'))

            // 未入力の感想数
            const feedbacksQuery = query(
                collection(db, 'feedbacks'),
                where('status', '==', 'unwritten')
            )
            const feedbacksSnapshot = await getDocs(feedbacksQuery)

            // 写真数
            const photosSnapshot = await getDocs(collection(db, 'photos'))

            setStats({
                upcomingEvents: upcomingEvents.length,
                totalCustomers: customersSnapshot.size,
                pendingFeedbacks: feedbacksSnapshot.size,
                totalPhotos: photosSnapshot.size
            })

            // 次のイベント
            if (upcomingEvents.length > 0) {
                const eventData = upcomingEvents[0].data()
                setNextEvent({
                    id: upcomingEvents[0].id,
                    ...eventData,
                    date: eventData.date?.toDate()
                })
            }
        } catch (error) {
            console.error('ダッシュボードデータの取得エラー:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (date) => {
        if (!date) return '-'
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        }).format(date)
    }

    const formatTime = (date) => {
        if (!date) return ''
        return new Intl.DateTimeFormat('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(date)
    }

    if (loading) {
        return (
            <div className="loading-spinner">
                <div className="spinner"></div>
            </div>
        )
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">ダッシュボード</h1>
                <p className="page-subtitle">
                    ようこそ、{userData?.displayName || 'ユーザー'}さん
                </p>
            </div>

            {/* 統計カード */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">📅</div>
                    <div className="stat-value">{stats.upcomingEvents}</div>
                    <div className="stat-label">今後のイベント</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{stats.totalCustomers}</div>
                    <div className="stat-label">登録顧客数</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">✏️</div>
                    <div className="stat-value">{stats.pendingFeedbacks}</div>
                    <div className="stat-label">未入力の感想</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">📷</div>
                    <div className="stat-value">{stats.totalPhotos}</div>
                    <div className="stat-label">ギャラリー写真</div>
                </div>
            </div>

            <div className="mb-lg">
                {/* 次のイベント */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">次のイベント</h3>
                    </div>
                    {nextEvent ? (
                        <div>
                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                                {nextEvent.title}
                            </h4>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {formatDate(nextEvent.date)} {formatTime(nextEvent.date)}
                            </p>
                            {nextEvent.timeSlot && (
                                <span className="badge badge-confirmed" style={{ marginTop: '8px' }}>
                                    {nextEvent.timeSlot}回
                                </span>
                            )}
                            {nextEvent.memo && (
                                <p className="text-sm mt-md" style={{ color: 'var(--text-tertiary)' }}>
                                    {nextEvent.memo}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '24px 0' }}>
                            <p className="text-sm text-muted">予定されているイベントはありません</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
