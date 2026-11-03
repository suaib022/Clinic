"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = 'patient' | 'doctor' | 'compounder' | 'admin';

const DEFAULT_CREDENTIALS: Record<Role, { identifier: string; pin: string }> = {
  compounder: {
    identifier: "compounder_DOC-532373@staff.clinic.local",
    pin: "123456"
  },
  doctor: {
    identifier: "doc-532373@staff.clinic.local",
    pin: "123456"
  },
  admin: {
    identifier: "admin@gmail.com",
    pin: "123456"
  },
  patient: {
    identifier: "UHID61569802",
    pin: "123456"
  }
};

export default function LoginForm({ error: initialError, message }: { error?: string, message?: string }) {
  const [role, setRole] = useState<Role>("patient");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState<Record<Role, { identifier: string; pin: string }>>({
    patient: { ...DEFAULT_CREDENTIALS.patient },
    doctor: { ...DEFAULT_CREDENTIALS.doctor },
    compounder: { ...DEFAULT_CREDENTIALS.compounder },
    admin: { ...DEFAULT_CREDENTIALS.admin }
  });

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setError(undefined);
    // Autofill with the role's default credentials
    setFormData(prev => ({
      ...prev,
      [newRole]: { ...DEFAULT_CREDENTIALS[newRole] }
    }));
  };

  const handlePatientLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    const identifier = formData.patient.identifier;
    const pin = formData.patient.pin;
    
    try {
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
          setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    const identifier = formData[role].identifier;
    const pin = formData[role].pin;
    
    try {
      const res = await fetch('/api/doctor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, pin, role })
      });
      const data = await res.json();
      if (res.ok) {
          router.refresh();
          const roleStr = data.user?.role;
          router.push(roleStr === 'admin' ? '/admin/dashboard' : `/${roleStr}/dashboard`);
      } else {
          setError(data.error || 'Login failed');
          setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
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
      <ul className="nav nav-pills nav-fill mb-4" style={{ gap: "10px" }} suppressHydrationWarning>
        <li className="nav-item">
          <button 
            type="button"
            className={`nav-link ${role === 'patient' ? 'active' : ''}`} 
            style={{ borderRadius: "8px", fontWeight: "600", backgroundColor: role === 'patient' ? 'var(--accent-color)' : '#f8f9fa', color: role === 'patient' ? '#fff' : '#333' }}
            onClick={() => handleRoleChange('patient')}
          >
            Patient
          </button>
        </li>
        <li className="nav-item">
          <button 
            type="button"
            className={`nav-link ${role === 'doctor' ? 'active' : ''}`} 
            style={{ borderRadius: "8px", fontWeight: "600", backgroundColor: role === 'doctor' ? 'var(--accent-color)' : '#f8f9fa', color: role === 'doctor' ? '#fff' : '#333' }}
            onClick={() => handleRoleChange('doctor')}
          >
            Doctor
          </button>
        </li>
        <li className="nav-item">
          <button 
            type="button"
            className={`nav-link ${role === 'compounder' ? 'active' : ''}`} 
            style={{ borderRadius: "8px", fontWeight: "600", backgroundColor: role === 'compounder' ? 'var(--accent-color)' : '#f8f9fa', color: role === 'compounder' ? '#fff' : '#333' }}
            onClick={() => handleRoleChange('compounder')}
          >
            Compounder
          </button>
        </li>
        <li className="nav-item">
          <button 
            type="button"
            className={`nav-link ${role === 'admin' ? 'active' : ''}`} 
            style={{ borderRadius: "8px", fontWeight: "600", backgroundColor: role === 'admin' ? 'var(--accent-color)' : '#f8f9fa', color: role === 'admin' ? '#fff' : '#333' }}
            onClick={() => handleRoleChange('admin')}
          >
            Admin
          </button>
        </li>
      </ul>

      <div className="appointment-form">
        {/* Patient Form */}
        {role === 'patient' && (
          <form onSubmit={handlePatientLogin}>
            <div className="row gy-4">
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>Mobile Number or UHID</label>
                <input 
                  type="text" 
                  name="mobile" 
                  className="form-control" 
                  placeholder="Enter your mobile number or UHID" 
                  value={formData.patient.identifier}
                  onChange={(e) => setFormData(prev => ({ ...prev, patient: { ...prev.patient, identifier: e.target.value } }))}
                  required 
                />
              </div>
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>PIN or Password</label>
                <div className="position-relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="pin" 
                    className="form-control pe-5" 
                    placeholder="Enter your PIN" 
                    value={formData.patient.pin}
                    onChange={(e) => setFormData(prev => ({ ...prev, patient: { ...prev.patient, pin: e.target.value } }))}
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none pe-3"
                    style={{ zIndex: 5 }}
                    tabIndex={-1}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
              
              <div className="col-12 mt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-book" 
                  style={{ width: "100%", padding: "12px 20px", border: "none", borderRadius: "4px", background: "var(--accent-color)", color: "#fff", fontWeight: "600" }}
                >
                  {loading ? 'Logging in...' : 'Login as Patient'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Doctor Form */}
        {role === 'doctor' && (
          <form onSubmit={handleStaffLogin}>
            <input type="hidden" name="role" value="doctor" />
            <div className="row gy-4">
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>Doctor ID / Email</label>
                <input 
                  type="text" 
                  name="identifier" 
                  className="form-control" 
                  placeholder="Enter your Doctor ID or Email" 
                  value={formData.doctor.identifier}
                  onChange={(e) => setFormData(prev => ({ ...prev, doctor: { ...prev.doctor, identifier: e.target.value } }))}
                  required 
                />
              </div>
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>PIN / Password</label>
                <div className="position-relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="pin" 
                    className="form-control pe-5" 
                    placeholder="Enter your PIN or Password" 
                    value={formData.doctor.pin}
                    onChange={(e) => setFormData(prev => ({ ...prev, doctor: { ...prev.doctor, pin: e.target.value } }))}
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none pe-3"
                    style={{ zIndex: 5 }}
                    tabIndex={-1}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
              
              <div className="col-12 mt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-book" 
                  style={{ width: "100%", padding: "12px 20px", border: "none", borderRadius: "4px", background: "var(--accent-color)", color: "#fff", fontWeight: "600" }}
                >
                  {loading ? 'Logging in...' : 'Login as Doctor'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Compounder Form */}
        {role === 'compounder' && (
          <form onSubmit={handleStaffLogin}>
            <input type="hidden" name="role" value="compounder" />
            <div className="row gy-4">
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>Compounder Email</label>
                <input 
                  type="email" 
                  name="identifier" 
                  className="form-control" 
                  placeholder="Compounder Email Address" 
                  value={formData.compounder.identifier}
                  onChange={(e) => setFormData(prev => ({ ...prev, compounder: { ...prev.compounder, identifier: e.target.value } }))}
                  required 
                />
              </div>
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>Password / PIN</label>
                <div className="position-relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="pin" 
                    className="form-control pe-5" 
                    placeholder="Password" 
                    value={formData.compounder.pin}
                    onChange={(e) => setFormData(prev => ({ ...prev, compounder: { ...prev.compounder, pin: e.target.value } }))}
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none pe-3"
                    style={{ zIndex: 5 }}
                    tabIndex={-1}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
              
              <div className="col-12 mt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-book" 
                  style={{ width: "100%", padding: "12px 20px", border: "none", borderRadius: "4px", background: "var(--accent-color)", color: "#fff", fontWeight: "600" }}
                >
                  {loading ? 'Logging in...' : 'Login as Compounder'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Admin Form */}
        {role === 'admin' && (
          <form onSubmit={handleStaffLogin}>
            <input type="hidden" name="role" value="admin" />
            <div className="row gy-4">
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>Admin Email</label>
                <input 
                  type="email" 
                  name="identifier" 
                  className="form-control" 
                  placeholder="Admin Email Address" 
                  value={formData.admin.identifier}
                  onChange={(e) => setFormData(prev => ({ ...prev, admin: { ...prev.admin, identifier: e.target.value } }))}
                  required 
                />
              </div>
              <div className="col-12">
                <label className="form-label" style={{ fontWeight: "600" }}>Password / PIN</label>
                <div className="position-relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="pin" 
                    className="form-control pe-5" 
                    placeholder="Password" 
                    value={formData.admin.pin}
                    onChange={(e) => setFormData(prev => ({ ...prev, admin: { ...prev.admin, pin: e.target.value } }))}
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none pe-3"
                    style={{ zIndex: 5 }}
                    tabIndex={-1}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
              
              <div className="col-12 mt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-book" 
                  style={{ width: "100%", padding: "12px 20px", border: "none", borderRadius: "4px", background: "var(--accent-color)", color: "#fff", fontWeight: "600" }}
                >
                  {loading ? 'Logging in...' : 'Login as Admin'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
