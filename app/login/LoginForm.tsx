"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm({ error: initialError, message }: { error?: string, message?: string }) {
  const [role, setRole] = useState("patient");
  const [error, setError] = useState(initialError);
  const router = useRouter();

  const handlePatientLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    const formData = new FormData(e.currentTarget);
    const identifier = formData.get('mobile') as string;
    const pin = formData.get('pin') as string;
    
    const res = await fetch('/api/patient/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, pin })
    });
    const data = await res.json();
    if (res.ok) {
        router.refresh();
        router.push('/patient/dashboard');
    } else {
        setError(data.error || 'Login failed');
    }
  };

  const handleStaffLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    const formData = new FormData(e.currentTarget);
    const identifier = formData.get('identifier') as string;
    const pin = formData.get('pin') as string;
    const roleType = formData.get('role') as string;
    
    const res = await fetch('/api/doctor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, pin, role: roleType })
    });
    const data = await res.json();
    if (res.ok) {
        router.refresh();
        const roleStr = data.user?.role;
        router.push(roleStr === 'admin' ? '/admin/dashboard' : `/${roleStr}/dashboard`);
    } else {
        setError(data.error || 'Login failed');
    }
  };

  return (
    <div className="booking-wrapper" style={{ padding: "40px", backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0px 0px 20px rgba(1, 41, 112, 0.1)" }}>
      <div className="booking-header text-center mb-4">
        <h2 style={{ fontSize: "24px", fontWeight: "600" }}>Login to your Account</h2>
        <p className="text-muted small">Select your role and enter credentials to login</p>
      </div>

      {error && (
        <div style={{ color: "#721c24", backgroundColor: "#f8d7da", padding: "10px", borderRadius: "5px", marginBottom: "20px" }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ color: "#155724", backgroundColor: "#d4edda", padding: "10px", borderRadius: "5px", marginBottom: "20px" }}>
          {message}
        </div>
      )}

      {/* Role Selection Tabs */}
      <ul className="nav nav-pills nav-fill mb-4" style={{ gap: "10px" }}>
        <li className="nav-item">
          <button 
            className={`nav-link ${role === 'patient' ? 'active' : ''}`} 
            style={{ borderRadius: "8px", fontWeight: "600", backgroundColor: role === 'patient' ? 'var(--accent-color)' : '#f8f9fa', color: role === 'patient' ? '#fff' : '#333' }}
            onClick={(e) => { e.preventDefault(); setRole('patient'); }}
          >
            Patient
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${role === 'doctor' ? 'active' : ''}`} 
            style={{ borderRadius: "8px", fontWeight: "600", backgroundColor: role === 'doctor' ? 'var(--accent-color)' : '#f8f9fa', color: role === 'doctor' ? '#fff' : '#333' }}
            onClick={(e) => { e.preventDefault(); setRole('doctor'); }}
          >
            Doctor
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${role === 'staff' ? 'active' : ''}`} 
            style={{ borderRadius: "8px", fontWeight: "600", backgroundColor: role === 'staff' ? 'var(--accent-color)' : '#f8f9fa', color: role === 'staff' ? '#fff' : '#333' }}
            onClick={(e) => { e.preventDefault(); setRole('staff'); }}
          >
            Admin/Staff
          </button>
        </li>
      </ul>

      <div className="appointment-form">
        {role === 'patient' && (
          <form onSubmit={handlePatientLogin}>
            <div className="row gy-4">
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>Mobile Number or UHID</label>
                <input type="text" name="mobile" className="form-control" placeholder="Enter your mobile number or UHID" required />
              </div>
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>PIN or Password</label>
                <input type="password" name="pin" className="form-control" placeholder="Enter your PIN" required />
              </div>
              
              <div className="col-12 mt-4">
                <button type="submit" className="btn-book" style={{ width: "100%", padding: "12px 20px", border: "none", borderRadius: "4px", background: "var(--accent-color)", color: "#fff", fontWeight: "600" }}>Login as Patient</button>
              </div>
            </div>
          </form>
        )}

        {role === 'doctor' && (
          <form onSubmit={handleStaffLogin}>
            <input type="hidden" name="role" value="doctor" />
            <div className="row gy-4">
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>Doctor ID / Email</label>
                <input type="text" name="identifier" className="form-control" placeholder="Enter your Doctor ID or Email" required />
              </div>
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>PIN / Password</label>
                <input type="password" name="pin" className="form-control" placeholder="Enter your PIN or Password" required />
              </div>
              
              <div className="col-12 mt-4">
                <button type="submit" className="btn-book" style={{ width: "100%", padding: "12px 20px", border: "none", borderRadius: "4px", background: "var(--accent-color)", color: "#fff", fontWeight: "600" }}>Login as Doctor</button>
              </div>
            </div>
          </form>
        )}

        {role === 'staff' && (
          <form onSubmit={handleStaffLogin}>
            <input type="hidden" name="role" value="staff" />
            <div className="row gy-4">
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>Admin / Compounder Email</label>
                <input type="email" name="identifier" className="form-control" placeholder="Staff Email Address" required />
              </div>
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>Password / PIN</label>
                <input type="password" name="pin" className="form-control" placeholder="Password" required />
              </div>
              
              <div className="col-12 mt-4">
                <button type="submit" className="btn-book" style={{ width: "100%", padding: "12px 20px", border: "none", borderRadius: "4px", background: "var(--accent-color)", color: "#fff", fontWeight: "600" }}>Login as Staff</button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
