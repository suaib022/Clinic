'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DoctorLoginClient() {
    const [identifier, setIdentifier] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: any) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/doctor/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, pin })
            });
            const data = await res.json();
            
            if (res.ok) {
                // Determine role and redirect
                if (data.user.role === 'admin') router.push('/admin/dashboard');
                else if (data.user.role === 'compounder') router.push('/compounder/dashboard');
                else router.push('/doctor/dashboard');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container py-5" style={{ maxWidth: '500px' }}>
            <div className="card shadow-sm border-0 rounded-0">
                <div className="card-header text-white text-center py-3" style={{ backgroundColor: '#0D7D72' }}>
                    <h4 className="mb-0">Staff Login</h4>
                </div>
                <div className="card-body p-4">
                    {error && <div className="alert alert-danger rounded-0 py-2">{error}</div>}
                    <form onSubmit={handleLogin}>
                        <div className="mb-3">
                            <label className="form-label small fw-bold">Doctor ID or Email</label>
                            <input 
                                type="text" 
                                className="form-control rounded-0" 
                                value={identifier} 
                                onChange={e => setIdentifier(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="mb-4">
                            <label className="form-label small fw-bold">PIN</label>
                            <input 
                                type="password" 
                                className="form-control rounded-0" 
                                value={pin} 
                                onChange={e => setPin(e.target.value)} 
                                required 
                            />
                        </div>
                        <button 
                            type="submit" 
                            className="btn text-white w-100 rounded-0 py-2 fw-bold" 
                            style={{ backgroundColor: '#0ab1a9' }}
                            disabled={loading}
                        >
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
