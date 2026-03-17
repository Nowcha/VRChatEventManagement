import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { logOut } from '../firebase'

export default function Sidebar({ isOpen, onClose }) {
    const { userData } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        try {
            await logOut()
            navigate('/login')
        } catch (error) {
            console.error('ログアウトエラー:', error)
        }
    }

    const navItems = [
        { path: '/dashboard', icon: '◈', label: 'ダッシュボード' },
        { path: '/shifts', icon: '◷', label: 'シフト管理' },
        { path: '/customers', icon: '♦', label: '顧客データベース' },
        { path: '/feedbacks', icon: '✎', label: '感想・接客記録' },
        { path: '/gallery', icon: '◫', label: 'ギャラリー' },
        { path: '/ideas', icon: '✦', label: 'タイトルアイデア' },
    ]

    const settingsItems = [
        { path: '/settings', icon: '⚙', label: '設定' },
    ]

    return (
        <>
            <div className={`sidebar-overlay ${isOpen ? 'visible' : ''}`} onClick={onClose} />
            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="logo-icon">✦</span>
                        <span>Event Manager</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <span className="nav-section-label">メニュー</span>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            onClick={onClose}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}

                    <span className="nav-section-label" style={{ marginTop: 'auto' }}>システム</span>
                    {settingsItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            onClick={onClose}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info" style={{ cursor: 'default' }}>
                        <div className="user-avatar">
                            {(userData?.displayName || 'U').charAt(0)}
                        </div>
                        <div className="user-details">
                            <div className="user-name">{userData?.displayName || 'ユーザー'}</div>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    )
}
