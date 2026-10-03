import Link from 'next/link';
import React from 'react';
import { logout } from '@/app/auth/actions';

type Role = 'patient' | 'doctor' | 'admin' | 'compounder';

export default function DashboardSidebar({ role }: { role: Role }) {
    let links: Array<{ href: string, label: string, icon: string }> = [];
    
    switch (role) {
        case 'patient':
            links = [
                { href: '/patient/dashboard', label: 'Dashboard', icon: 'bi-grid' },
                { href: '/patient/members', label: 'My Family / Patients', icon: 'bi-people' },
                { href: '/patient/appointments', label: 'My Appointments', icon: 'bi-calendar-check' },
                { href: '/patient/book', label: 'Book Appointment', icon: 'bi-plus-circle' },
                { href: '/patient/records', label: 'Medical Records', icon: 'bi-file-medical' },
                { href: '/patient/settings', label: 'Profile Settings', icon: 'bi-gear' },
            ];
            break;
        case 'doctor':
            links = [
                { href: '/doctor/dashboard', label: 'Dashboard', icon: 'bi-grid' },
                { href: '/doctor/appointments', label: 'Today\'s Appointments', icon: 'bi-calendar-check' },
                { href: '/doctor/patients', label: 'Patient Records', icon: 'bi-file-medical' },
                { href: '/doctor/schedule', label: 'My Schedule', icon: 'bi-clock' },
                { href: '/doctor/leave', label: 'Leave Requests', icon: 'bi-calendar-x' },
                { href: '/doctor/profile', label: 'Profile', icon: 'bi-person' },
            ];
            break;
        case 'admin':
            links = [
                { href: '/admin/dashboard', label: 'Dashboard', icon: 'bi-grid' },
                { href: '/admin/appointments', label: 'All Appointments', icon: 'bi-calendar-check' },
                { href: '/admin/doctors', label: 'Doctors', icon: 'bi-people' },
                { href: '/admin/patients', label: 'Patients', icon: 'bi-person-badge' },
                { href: '/admin/specialities', label: 'Specialities', icon: 'bi-tags' },
                { href: '/admin/reports', label: 'Reports', icon: 'bi-bar-chart' },
                { href: '/admin/settings', label: 'Settings', icon: 'bi-gear' },
            ];
            break;
        case 'compounder':
            links = [
                { href: '/compounder/dashboard', label: 'Dashboard', icon: 'bi-grid' },
                { href: '/compounder/patients', label: 'Assigned Patients', icon: 'bi-people' },
                { href: '/compounder/upload', label: 'Upload Documents', icon: 'bi-file-arrow-up' },
            ];
            break;
    }

    const roleTitles = {
        patient: 'Patient Portal',
        doctor: 'Doctor Panel',
        admin: 'Admin Center',
        compounder: 'Staff Portal'
    };

    return (
        <div className="dashboard-sidebar bg-white shadow-sm p-3 d-none d-md-block" style={{ width: '280px', borderRight: '1px solid #eee' }}>
            <div className="d-flex flex-column h-100">
                <div className="mb-4 px-3 py-2">
                    <h5 className="m-0 fw-bold" style={{ color: '#0D7D72' }}>
                        <i className="bi bi-shield-check me-2"></i>
                        {roleTitles[role]}
                    </h5>
                </div>
                <ul className="nav nav-pills flex-column mb-auto">
                    {links.map((link, i) => (
                        <li className="nav-item mb-2" key={i}>
                            <Link href={link.href} className="nav-link text-dark d-flex align-items-center p-3 rounded-3 hover-bg-light fw-medium" style={{ gap: '12px', transition: 'all 0.2s' }}>
                                <i className={`bi ${link.icon} fs-5`}></i>
                                <span>{link.label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
                <hr className="my-4" />
                <div className="mt-auto">
                    <form action={logout}>
                        <button type="submit" className="btn btn-light w-100 text-start d-flex align-items-center text-danger p-3 rounded-3 hover-bg-light-danger fw-medium" style={{ gap: '12px' }}>
                            <i className="bi bi-box-arrow-right fs-5"></i>
                            <span>Logout</span>
                        </button>
                    </form>
                </div>
            </div>
            <style>{`
                .hover-bg-light:hover {
                    background-color: rgba(13, 125, 114, 0.1);
                    color: #0D7D72 !important;
                }
                .hover-bg-light-danger:hover {
                    background-color: rgba(220, 53, 69, 0.1);
                }
            `}</style>
        </div>
    );
}
