'use client';

import React, { useState } from 'react';
import { updateProfile, changePin } from './actions';

export default function ProfileForms({ user, doctorDetails }: { user: any, doctorDetails: any }) {
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isPinModalOpen, setPinModalOpen] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const handleUpdateProfile = async (formData: FormData) => {
        const res = await updateProfile(formData);
        if (res.error) {
            setMessage({ text: res.error, type: 'danger' });
        } else {
            setMessage({ text: 'Profile updated successfully!', type: 'success' });
            setEditModalOpen(false);
        }
    };

    const handleChangePin = async (formData: FormData) => {
        const res = await changePin(formData);
        if (res.error) {
            setMessage({ text: res.error, type: 'danger' });
        } else {
            setMessage({ text: 'PIN changed successfully!', type: 'success' });
            setPinModalOpen(false);
        }
    };

    return (
        <>
            {message.text && (
                <div className={`alert alert-${message.type} mt-3 alert-dismissible`} role="alert">
                    {message.text}
                    <button type="button" className="btn-close" onClick={() => setMessage({text:'', type:''})}></button>
                </div>
            )}
            
            <div className="mt-4 pt-3 border-top">
                <button 
                    onClick={() => setEditModalOpen(true)} 
                    className="btn text-white me-2" 
                    style={{ backgroundColor: '#0ab1a9' }}>
                    Edit Profile
                </button>
                <button 
                    onClick={() => setPinModalOpen(true)} 
                    className="btn btn-outline-secondary">
                    Change PIN
                </button>
            </div>

            {/* Edit Profile Modal */}
            {isEditModalOpen && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <form action={handleUpdateProfile}>
                                <div className="modal-header">
                                    <h5 className="modal-title">Edit Profile</h5>
                                    <button type="button" className="btn-close" onClick={() => setEditModalOpen(false)}></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label">Full Name</label>
                                        <input type="text" name="full_name" className="form-control" defaultValue={user?.full_name} required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Email</label>
                                        <input type="email" name="email" className="form-control" defaultValue={user?.email} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Consultation Fee ($)</label>
                                        <input type="number" step="0.01" name="consultation_fee" className="form-control" defaultValue={doctorDetails?.consultation_fee} />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn text-white" style={{ backgroundColor: '#0ab1a9' }}>Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Change PIN Modal */}
            {isPinModalOpen && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <form action={handleChangePin}>
                                <div className="modal-header">
                                    <h5 className="modal-title">Change PIN</h5>
                                    <button type="button" className="btn-close" onClick={() => setPinModalOpen(false)}></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label">Current PIN</label>
                                        <input type="password" name="current_pin" className="form-control" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">New PIN</label>
                                        <input type="password" name="new_pin" className="form-control" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Confirm New PIN</label>
                                        <input type="password" name="confirm_pin" className="form-control" required />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setPinModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn text-white" style={{ backgroundColor: '#0ab1a9' }}>Update PIN</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
