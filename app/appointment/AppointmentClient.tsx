'use client';

import React, { useState, useEffect } from 'react';
import { format, addMinutes, parse } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export default function AppointmentClient() {
  const [specialities, setSpecialities] = useState([]);
  const [doctors, setDoctors] = useState([]);
  
  const [selectedSpeciality, setSelectedSpeciality] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  
  const nowInDhaka = toZonedTime(new Date(), 'Asia/Dhaka');
  const todayStr = format(nowInDhaka, 'yyyy-MM-dd');
  
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [doctorDetails, setDoctorDetails] = useState<any>(null);
  
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/specialities')
      .then(r => r.json())
      .then(data => {
         if (Array.isArray(data)) setSpecialities(data);
      });
  }, []);

  useEffect(() => {
    const url = selectedSpeciality ? `/api/doctors?speciality_id=${selectedSpeciality}` : '/api/doctors';
    fetch(url)
      .then(r => r.json())
      .then(data => {
         if (Array.isArray(data)) setDoctors(data);
      });
  }, [selectedSpeciality]);
  
  useEffect(() => {
    if (selectedDoctorId) {
      fetch(`/api/doctors/${selectedDoctorId}`)
        .then(r => r.json())
        .then(data => {
            if (!data.error) {
                setDoctorDetails(data);
                if (data.speciality_id) {
                    setSelectedSpeciality(prev => prev || data.speciality_id);
                }
            }
        });
    }
  }, [selectedDoctorId]);
  
  useEffect(() => {
    if (selectedDoctorId && selectedDate) {
      setLoading(true);
      fetch(`/api/doctors/${selectedDoctorId}/slots?date=${selectedDate}`)
        .then(r => r.json())
        .then(data => {
            if (data.slots) setSlots(data.slots);
            else setSlots([]);
        })
        .finally(() => setLoading(false));
    } else {
      setSlots([]);
    }
  }, [selectedDoctorId, selectedDate]);
  
  const handleReset = () => {
      setSelectedSpeciality('');
      setSelectedDoctorId('');
      setSelectedDate(todayStr);
      setSlots([]);
      setSelectedSlot('');
      setDoctorDetails(null);
      setError('');
      setSuccess('');
  };
  
  const handleNext = async () => {
      if (!selectedDoctorId || !selectedDate || !selectedSlot) return;
      setError('');
      setSuccess('');
      try {
          const res = await fetch('/api/appointments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  doctor_id: selectedDoctorId,
                  appointment_date: selectedDate,
                  start_time: selectedSlot
              })
          });
          const data = await res.json();
          if (res.ok) {
              setSuccess('Appointment booked successfully!');
              fetch(`/api/doctors/${selectedDoctorId}/slots?date=${selectedDate}`)
                  .then(r => r.json())
                  .then(d => setSlots(d.slots || []));
              setSelectedSlot('');
          } else {
              setError(data.error || 'Failed to book appointment');
          }
      } catch (err: any) {
          setError(err.message);
      }
  };
  
  const daysMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="container py-4">
      {/* Header Match */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
         <a href="/" className="logo d-flex align-items-center text-decoration-none">
            <h1 className="sitename m-0" style={{ fontSize: '32px', color: '#0D7D72' }}>Clinic</h1>
         </a>
         <h3 className="m-0" style={{ color: '#0D7D72' }}>Book an Appointment</h3>
      </div>
      
      <div className="row">
         {/* Left Panel */}
         <div className="col-md-4">
            <div className="card border-0 rounded-0 shadow-sm mb-4">
                <div className="card-header text-white rounded-0 py-3" style={{ backgroundColor: '#0D7D72' }}>
                   <div className="d-flex align-items-center">
                       <div className="bg-white rounded-circle me-3 overflow-hidden d-flex justify-content-center align-items-center flex-shrink-0" style={{ width: '80px', height: '80px' }}>
                           {doctorDetails?.avatar_url ? (
                               <img src={doctorDetails.avatar_url} alt="Doctor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                           ) : (
                               <i className="bi bi-person-fill text-secondary" style={{ fontSize: '3rem' }}></i>
                           )}
                       </div>
                       <div>
                           <h5 className="mb-0 fw-bold">{doctorDetails?.full_name?.toUpperCase() || 'SELECT A DOCTOR'}</h5>
                           <small>{doctorDetails?.speciality || ''}</small>
                       </div>
                   </div>
                </div>
                <div className="card-body">
                   <h6 className="fw-bold mb-3 small">LABAID CARDIAC HOSPITAL :</h6>
                   {doctorDetails?.schedules && doctorDetails.schedules.length > 0 ? (
                       <ul className="list-unstyled mb-0" style={{ fontSize: '13px' }}>
                          {doctorDetails.schedules.map((s: any, i: number) => {
                              const formatTime = (t: string) => format(parse(t, 'HH:mm:ss', new Date()), 'h:mm a');
                              const start = formatTime(s.start_time);
                              const end = formatTime(s.end_time);
                              return (
                                  <li key={i} className="mb-1">
                                     {daysMap[s.day_of_week]}: {start} - {end}
                                  </li>
                              );
                          })}
                       </ul>
                   ) : (
                       <p className="text-muted small">No schedule available.</p>
                   )}
                </div>
            </div>
         </div>
         
         {/* Right Panel */}
         <div className="col-md-8 pl-md-4">
            {error && <div className="alert alert-danger rounded-0 py-2">{error}</div>}
            {success && <div className="alert alert-success rounded-0 py-2">{success}</div>}
         
            <div className="row g-3 mb-4">
               <div className="col-md-6">
                  <label className="form-label small mb-1">Facility Name <span className="text-danger">*</span></label>
                  <input type="text" className="form-control rounded-0 border-secondary-subtle" value="LABAID CARDIAC HOSPITAL" readOnly />
               </div>
               <div className="col-md-6">
                  <label className="form-label small mb-1">Select Speciality <span className="text-danger">*</span></label>
                  <select suppressHydrationWarning className="form-select rounded-0 border-secondary-subtle" value={selectedSpeciality} onChange={e => {
                      setSelectedSpeciality(e.target.value);
                      setSelectedDoctorId('');
                      setDoctorDetails(null);
                      setSlots([]);
                  }} disabled={specialities.length === 0}>
                     <option value="">-- Select --</option>
                     {specialities.map((s: any) => (
                         <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
                     ))}
                  </select>
               </div>
               <div className="col-md-6">
                  <label className="form-label small mb-1">Select Doctor <span className="text-danger">*</span></label>
                  <select suppressHydrationWarning className="form-select rounded-0 border-secondary-subtle" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)} disabled={doctors.length === 0}>
                     <option value="">-- Select --</option>
                     {doctors.map((d: any) => (
                         <option key={d.id} value={d.id}>{d.full_name.toUpperCase()}</option>
                     ))}
                  </select>
               </div>
               <div className="col-md-4">
                  <label className="form-label small mb-1">Appointment Date <span className="text-danger">*</span></label>
                  <input type="date" className="form-control rounded-0 border-secondary-subtle" value={selectedDate} min={todayStr} onChange={e => setSelectedDate(e.target.value)} />
               </div>
               <div className="col-md-2">
                  <label className="form-label small mb-1">Consultation<span className="text-danger">*</span></label>
                  <div className="form-control bg-light text-danger fw-bold text-center rounded-0 border-0" style={{ fontSize: '12px', padding: '0.375rem 0.2rem' }}>
                     {doctorDetails ? `Taka. ${doctorDetails.consultation_fee}` : ''}
                  </div>
               </div>
            </div>
            
            {/* Slot Grid */}
            {selectedDoctorId && selectedDate ? (
                loading ? <p className="text-muted small">Loading slots...</p> :
                slots.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2">
                        {slots.map((slot, i) => (
                            <button 
                                key={i}
                                disabled={!slot.available}
                                onClick={() => setSelectedSlot(slot.start_time)}
                                className={`border rounded-0 ${
                                    slot.start_time === selectedSlot ? 'text-white fw-bold' : 
                                    slot.available ? 'bg-white' : 'bg-light text-muted text-decoration-line-through opacity-50'
                                }`}
                                style={{ 
                                    width: '80px', 
                                    fontSize: '13px', 
                                    padding: '0.4rem 0',
                                    ...(slot.start_time === selectedSlot ? { backgroundColor: '#0D7D72', borderColor: '#0D7D72' } : 
                                        slot.available ? { borderColor: '#0D7D72', color: '#0D7D72' } : 
                                        {})
                                }}
                            >
                                {slot.time}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-danger fw-bold mt-2" style={{ fontSize: '14px' }}>Please call at 10606 for appointment booking.</p>
                )
            ) : (
                <p className="text-danger fw-bold mt-2" style={{ fontSize: '14px' }}>Please call at 10606 for appointment booking.</p>
            )}
            
            {/* Bottom Actions */}
            <div className="d-flex justify-content-end mt-5 pt-3">
               <button className="btn btn-info text-white rounded-0 me-2 px-4" style={{ backgroundColor: '#0D7D72', borderColor: '#0D7D72' }} onClick={handleReset}>Reset</button>
               <button className="btn btn-info text-white rounded-0 px-4 opacity-50" style={{ backgroundColor: '#0D7D72', borderColor: '#0D7D72' }} disabled={!selectedDoctorId || !selectedDate || !selectedSlot} onClick={handleNext}>Next</button>
            </div>
         </div>
      </div>
    </div>
  );
}
