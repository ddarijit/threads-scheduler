import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Settings, CreditCard, LogOut, PlusSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './DashboardLayout.css';

const Sidebar = () => {
    const { signOut } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    return (
        <aside className="sidebar glass">
            <div className="logo">
                <span className="gradient-text">ThreadMaster</span>
            </div>
            <nav>
                <SidebarLink to="/dashboard" end icon={<LayoutDashboard size={20} />} label="Queue" />
                <SidebarLink to="/dashboard/calendar" icon={<Calendar size={20} />} label="Calendar" />
                <SidebarLink to="/dashboard/settings" icon={<Settings size={20} />} label="Settings" />
                <SidebarLink to="/dashboard/billing" icon={<CreditCard size={20} />} label="Billing" />
            </nav>
            <div className="sidebar-footer">
                <button className="logout-btn" onClick={handleLogout}>
                    <LogOut size={18} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
};

const SidebarLink = ({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) => (
    <NavLink
        to={to}
        end={end}
        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
    >
        {icon}
        <span>{label}</span>
    </NavLink>
);

import { useState } from 'react';
import { CreateThreadModal } from './CreateThreadModal';

export const DashboardLayout = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    // Force a re-render of the outlet key to refresh lists if needed, 
    // or we can rely on page-level fetching on mount. For now, simple close is fine.

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <header className="top-bar glass">
                    <h2>Dashboard</h2>
                    <button
                        className="btn-primary flex items-center gap-2"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <PlusSquare size={18} />
                        <span>New Thread</span>
                    </button>
                </header>
                <div className="content-area">
                    <Outlet />
                </div>
            </main>

            <CreateThreadModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    // Ideally check which page is active and refresh it,
                    // but usually navigating or window reload is a quick hack.
                    // For a better UX, we'd use a context or event bus, but let's just reload for MVP
                    // to ensure the list updates until we refactor Queue to use a shared context.
                    window.location.reload();
                }}
            />
        </div>
    );
};
