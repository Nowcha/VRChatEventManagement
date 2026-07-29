import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

// Matches the breakpoint where index.css turns the sidebar into a drawer.
const DRAWER_BREAKPOINT = 1024

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    useBodyScrollLock(sidebarOpen)

    // Rotating a phone or resizing past the breakpoint makes the sidebar
    // permanent again; leaving `open` set would keep the scroll lock on.
    useEffect(() => {
        if (!sidebarOpen) return undefined

        const handleResize = () => {
            if (window.innerWidth > DRAWER_BREAKPOINT) {
                setSidebarOpen(false)
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [sidebarOpen])

    return (
        <div className="app-layout">
            <div className="mobile-header">
                <button
                    className="menu-toggle"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="メニューを開く"
                    aria-expanded={sidebarOpen}
                >
                    ≡
                </button>
                <div className="sidebar-logo" style={{ marginLeft: '8px' }}>
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
