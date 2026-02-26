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
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div>
                        <div className="stat-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                        </div>
                        <div className="stat-value">{stats.upcomingEvents}</div>
                        <div className="stat-label mb-md">今後のイベント</div>
                    </div>
                    {nextEvent && (
                        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>次: {nextEvent.title}</div>
                            <div style={{ color: 'var(--text-tertiary)' }}>{formatDate(nextEvent.date)} {formatTime(nextEvent.date)}</div>
                        </div>
                    )}
                </div>
                <div className="stat-card">
                    <div className="stat-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <div className="stat-value">{stats.totalCustomers}</div>
                    <div className="stat-label">登録顧客数</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                    </div>
                    <div className="stat-value">{stats.pendingFeedbacks}</div>
                    <div className="stat-label">未入力の感想</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                    </div>
                    <div className="stat-value">{stats.totalPhotos}</div>
                    <div className="stat-label">ギャラリー写真</div>
                </div>
            </div>

        </div>
    )
}
