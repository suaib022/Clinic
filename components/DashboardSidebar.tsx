'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import SidebarLogoutButton from '@/components/SidebarLogoutButton';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useAuth } from '@/components/AuthProvider';

type Role = 'patient' | 'doctor' | 'admin' | 'compounder';

const LINKS: Record<Role, Array<{ href: string; label: string; icon: string }>> = {
    patient: [
        { href: '/patient/dashboard', label: 'Dashboard', icon: 'bi-grid' },
        { href: '/patient/members', label: 'My Family / Patients', icon: 'bi-people' },
        { href: '/patient/appointments', label: 'My Appointments', icon: 'bi-calendar-check' },
        { href: '/patient/book', label: 'Book Appointment', icon: 'bi-plus-circle' },
        { href: '/patient/records', label: 'Medical Records', icon: 'bi-file-medical' },
        { href: '/notifications', label: 'Notifications', icon: 'bi-bell' },
        { href: '/patient/settings', label: 'Profile Settings', icon: 'bi-gear' },
    ],
    doctor: [
        { href: '/doctor/dashboard', label: 'Dashboard', icon: 'bi-grid' },
        { href: '/doctor/queue', label: 'Live Queue', icon: 'bi-broadcast' },
        { href: '/dashboard/triage', label: 'Aura Triage Desk', icon: 'bi-robot' },
        { href: '/doctor/appointments', label: 'Today\'s Appointments', icon: 'bi-calendar-check' },
        { href: '/doctor/all-appointments', label: 'All Appointments', icon: 'bi-list-ul' },
        { href: '/doctor/patients', label: 'Patient Records', icon: 'bi-file-medical' },
        { href: '/doctor/schedule', label: 'My Schedule', icon: 'bi-clock' },
        { href: '/doctor/leave', label: 'Leave Requests', icon: 'bi-calendar-x' },
        { href: '/notifications', label: 'Notifications', icon: 'bi-bell' },
        { href: '/doctor/profile', label: 'Profile', icon: 'bi-person' },
    ],
    admin: [
        { href: '/admin/dashboard', label: 'Dashboard', icon: 'bi-grid' },
        { href: '/admin/queue-board', label: 'Live Clinic Board', icon: 'bi-broadcast' },
        { href: '/dashboard/triage', label: 'Aura Triage Desk', icon: 'bi-robot' },
        { href: '/admin/appointments', label: 'All Appointments', icon: 'bi-calendar-check' },
        { href: '/admin/doctors', label: 'Doctors', icon: 'bi-people' },
        { href: '/admin/patients', label: 'Patients', icon: 'bi-person-badge' },
        { href: '/admin/compounders', label: 'Compounders', icon: 'bi-person-badge-fill' },
        { href: '/admin/specialities', label: 'Specialities', icon: 'bi-tags' },
        { href: '/admin/reports', label: 'Health Insights', icon: 'bi-bar-chart' },
        { href: '/admin/queue-reports', label: 'Queue Reports', icon: 'bi-graph-up' },
        { href: '/admin/queue-settings', label: 'Queue Settings', icon: 'bi-sliders' },
        { href: '/notifications', label: 'Notifications', icon: 'bi-bell' },
        { href: '/admin/settings', label: 'Settings', icon: 'bi-gear' },
    ],
    compounder: [
        { href: '/compounder/dashboard', label: 'Dashboard', icon: 'bi-grid' },
        { href: '/compounder/queue', label: 'Live Queue', icon: 'bi-broadcast' },
        { href: '/compounder/bookings', label: 'Bookings', icon: 'bi-calendar-check' },
        { href: '/compounder/walk-in', label: 'Add Walk-in', icon: 'bi-person-plus' },
        { href: '/compounder/upload', label: 'Upload Documents', icon: 'bi-file-arrow-up' },
        { href: '/notifications', label: 'Notifications', icon: 'bi-bell' },
    ],
};

const ROLE_TITLES: Record<Role, string> = {
    patient: 'Patient Portal',
    doctor: 'Doctor Panel',
    admin: 'Admin Center',
    compounder: 'Staff Portal',
};

export default function DashboardSidebar({ role }: { role: Role }) {
    const pathname = usePathname();
    const { user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const links = LINKS[role];
    const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

    return (
        <>
            {/* Phones: top bar with menu + bell (the sidebar below is hidden under md). */}
            <div className="d-md-none position-fixed top-0 start-0 end-0 bg-white shadow-sm d-flex align-items-center justify-content-between px-3"
                style={{ height: 52, zIndex: 1040 }}>
                <button type="button" className="btn btn-link text-dark p-1" aria-label="Menu" aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((o) => !o)} style={{ fontSize: 24 }}>
                    <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true"></i>
                </button>
                <strong style={{ color: '#0D7D72' }}>{ROLE_TITLES[role]}</strong>
                {user ? <NotificationBell userId={user.id} /> : <span style={{ width: 32 }} />}
                {menuOpen && (
                    <nav className="position-absolute start-0 end-0 bg-white shadow border-top" style={{ top: 52, maxHeight: 'calc(100vh - 52px)', overflowY: 'auto' }}>
                        <ul className="nav flex-column p-2 m-0">
                            {links.map((link) => (
                                <li className="nav-item" key={link.href}>
                                    <Link href={link.href} onClick={() => setMenuOpen(false)}
                                        className={`nav-link d-flex align-items-center gap-3 py-3 rounded-3 ${isActive(link.href) ? 'active-nav-link' : 'text-dark'}`}>
                                        <i className={`bi ${link.icon} fs-5`}></i><span>{link.label}</span>
                                    </Link>
                                </li>
                            ))}
                            <li className="nav-item px-2 pt-2"><SidebarLogoutButton /></li>
                        </ul>
                    </nav>
                )}
            </div>

            {/* Desktop: bell in the top-right corner of every dashboard page. */}
            {user && (
                <div className="d-none d-md-block position-fixed" style={{ top: 14, right: 24, zIndex: 1040 }}>
                    <div className="bg-white rounded-circle shadow-sm d-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                        <NotificationBell userId={user.id} />
                    </div>
                </div>
            )}

            <div className="dashboard-sidebar bg-white shadow-sm p-3 d-none d-md-flex flex-column flex-shrink-0" style={{ width: '280px', borderRight: '1px solid #eee', minHeight: 'calc(100vh - 100px)', position: 'sticky', top: '100px', height: 'calc(100vh - 100px)', overflowY: 'auto' }}>
                <div className="mb-4 px-3 py-2">
                    <h5 className="m-0 fw-bold" style={{ color: '#0D7D72' }}>
                        <i className="bi bi-shield-check me-2"></i>
                        {ROLE_TITLES[role]}
                    </h5>
                </div>
                <ul className="nav nav-pills flex-column mb-auto">
                    {links.map((link) => (
                        <li className="nav-item mb-2" key={link.href}>
                            <Link
                                href={link.href}
                                className={`nav-link d-flex align-items-center p-3 rounded-3 fw-medium ${isActive(link.href) ? 'active-nav-link' : 'text-dark hover-bg-light'}`}
                                style={{ gap: '12px', transition: 'all 0.2s' }}
                            >
                                <i className={`bi ${link.icon} fs-5`}></i>
                                <span>{link.label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
                <hr className="my-4" />
                <div className="mt-auto">
                    <SidebarLogoutButton />
                </div>
            </div>
            <style jsx global>{`
                .hover-bg-light:hover {
                    background-color: rgba(13, 125, 114, 0.1);
                    color: #0D7D72 !important;
                }
                .active-nav-link {
                    background-color: rgba(13, 125, 114, 0.1);
                    color: #0D7D72 !important;
                    font-weight: 600 !important;
                }
            `}</style>
        </>
    );
}
