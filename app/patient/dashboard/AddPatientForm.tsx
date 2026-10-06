"use client";

import { useState } from "react";
import { addPatientToAccount } from "./actions";

export default function AddPatientForm() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [gender, setGender] = useState('Male');

    const handleTitleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === 'Mr.') {
            setGender('Male');
        } else if (val === 'Ms.' || val === 'Mrs.' || val === 'Mst.') {
            setGender('Female');
        }
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            await addPatientToAccount(new FormData(e.currentTarget));
            // Close modal using bootstrap (if jQuery/Bootstrap JS is loaded)
            if (typeof document !== 'undefined') {
                const closeBtn = document.querySelector('#addPatientModal .btn-close') as HTMLButtonElement;
                if (closeBtn) closeBtn.click();
            }
            // Clear form
            (e.target as HTMLFormElement).reset();
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message || 'Failed to add patient');
            } else {
                setError('Failed to add patient');
            }
        } finally {
            setLoading(false);
        }
    }

    const today = new Date().toISOString().split('T')[0];

    return (
        <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-danger p-2 rounded-0 small">{error}</div>}
            
            <div className="mb-3">
                <label className="form-label small fw-bold">Title</label>
                <select name="title" className="form-select" required defaultValue="Mr." onChange={handleTitleChange}>
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Mst.">Mst.</option>
                </select>
            </div>
            
            <div className="mb-3">
                <label className="form-label small fw-bold">Full Name</label>
                <input type="text" name="full_name" className="form-control" required />
            </div>

            <div className="mb-3">
                <label className="form-label small fw-bold">Father/Husband Name (Optional)</label>
                <input type="text" name="father_name" className="form-control" />
            </div>

            <div className="row mb-3">
                <div className="col-md-6">
                    <label className="form-label small fw-bold">Gender</label>
                    <select name="gender" className="form-select" required value={gender} onChange={(e) => setGender(e.target.value)}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div className="col-md-6">
                    <label className="form-label small fw-bold">Date of Birth</label>
                    <input type="date" name="dob" className="form-control" required max={today} />
                </div>
            </div>

            <div className="mb-4">
                <label className="form-label small fw-bold">Mobile Number</label>
                <input 
                    type="tel" 
                    name="mobile_no" 
                    className="form-control" 
                    required 
                    placeholder="e.g. +88018XXXXXXXX"
                    defaultValue="+8801"
                    maxLength={14}
                    pattern="^\+8801[3-9]\d{8}$"
                    title="Please enter a valid Bangladeshi mobile number starting with +8801"
                />
            </div>

            <div className="d-grid">
                <button type="submit" className="btn text-white rounded-0" style={{ backgroundColor: '#0ab1a9' }} disabled={loading}>
                    {loading ? 'Adding...' : 'Add Patient'}
                </button>
            </div>
        </form>
    );
}
