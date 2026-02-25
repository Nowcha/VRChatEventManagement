import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="app-layout">
            <div className="mobile-header">
                <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
                    ≡
                </button>
                <div className="sidebar-logo" style={{ marginLeft: '12px' }}>
                    <span className="logo-icon">✦</span>
                    <span>Event Manager</span>
                </div>
            </div>

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="main-content fade-in">
                <Outlet />
            </main>
        </div>
    )
}
