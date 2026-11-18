'use client';

import React, { useState, useEffect } from 'react';
import { format, addMinutes, parse, differenceInYears, addYears, differenceInMonths, addMonths, differenceInDays, subYears, subMonths, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
export default function AppointmentClient({ userPatients, isDashboard }: { userPatients?: any[], isDashboard?: boolean }) {
  const [specialities, setSpecialities] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  
  const [selectedSpeciality, setSelectedSpeciality] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  
  const [todayStr, setTodayStr] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    const tzDate = format(toZonedTime(new Date(), 'Asia/Dhaka'), 'yyyy-MM-dd');
    setTodayStr(tzDate);
    setSelectedDate(tzDate);
  }, []);
  
  const [step, setStep] = useState<1 | 2>(1);
  const [patientType, setPatientType] = useState<'OLD' | 'NEW'>('OLD');
  const [doctorDetails, setDoctorDetails] = useState<any>(null);
  
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newPatientForm, setNewPatientForm] = useState({
      title: '', full_name: '', father_name: '', gender: 'Male', dob: '', 
      ageY: '', ageM: '', ageD: '', mobile_no: '+8801', email: '', 
      address: '', country: '', state: '', city: ''
  });
  const [oldSearch, setOldSearch] = useState({ type: 'mobile', q: '' });
  const [oldPatientsList, setOldPatientsList] = useState<any[]>([]);
  const [selectedOldPatientId, setSelectedOldPatientId] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'counter'>('online');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentRedirecting, setPaymentRedirecting] = useState(false);

  const handleDobChange = (e: any) => {
      const dobStr = e.target.value;
      setNewPatientForm(p => ({ ...p, dob: dobStr }));
      if (dobStr) {
          try {
              const dob = new Date(dobStr);
              const now = new Date();
              const y = differenceInYears(now, dob);
              const dateAfterY = addYears(dob, y);
              const m = differenceInMonths(now, dateAfterY);
              const dateAfterM = addMonths(dateAfterY, m);
              const d = differenceInDays(now, dateAfterM);
              setNewPatientForm(p => ({ ...p, ageY: y.toString(), ageM: m.toString(), ageD: d.toString() }));
          } catch(e) {}
      }
  };

  const handleAgeChange = (field: string, val: string) => {
      setNewPatientForm(p => {
          const next = { ...p, [field]: val };
          const y = parseInt(next.ageY || '0');
          const m = parseInt(next.ageM || '0');
          const d = parseInt(next.ageD || '0');
          let date = new Date();
          date = subYears(date, y);
          date = subMonths(date, m);
          date = subDays(date, d);
          next.dob = format(date, 'yyyy-MM-dd');
          return next;
      });
  };

  const searchOldPatient = async () => {
      if (!oldSearch.q) return;
      try {
          const res = await fetch(`/api/patients/search?type=${oldSearch.type}&q=${oldSearch.q}`);
          const data = await res.json();
          if (data.patients) {
              setOldPatientsList(data.patients);
              if (data.patients.length > 0) {
                  setSelectedOldPatientId(data.patients[0].id);
              }
          }
      } catch(e) {}
  };

  const handleSubmitAppointmentNew = async () => {
      if (!selectedSpeciality || !selectedDoctorId || !selectedDate || !selectedSlot) {
          setError('Please select all appointment details in step 1');
          return;
      }
      setError('');
      setSuccess('');
      setIsSubmitting(true);
      try {
          let payload: any = {
              doctor_id: selectedDoctorId,
              appointment_date: selectedDate,
              start_time: selectedSlot,
              patientType: patientType
          };
          if (patientType === 'NEW') {
              if (!newPatientForm.full_name || !newPatientForm.mobile_no || !newPatientForm.title) {
                  setError('Please fill all mandatory fields (Title, Name, Mobile)');
                  setIsSubmitting(false);
                  return;
              }
              if (!/^\+8801[3-9]\d{8}$/.test(newPatientForm.mobile_no)) {
                  setError('Please enter a valid Bangladeshi mobile number starting with +8801');
                  setIsSubmitting(false);
                  return;
              }
              if (newPatientForm.dob) {
                  const today = new Date().toISOString().split('T')[0];
                  if (newPatientForm.dob >= today) {
                      setError('Date of birth must be a past date');
                      setIsSubmitting(false);
                      return;
                  }
              }
              payload.patientData = newPatientForm;
          } else {
              if (!selectedOldPatientId) {
                  setError('Please select an old patient');
                  setIsSubmitting(false);
                  return;
              }
              payload.oldPatientId = selectedOldPatientId;
          }

          const res = await fetch('/api/appointments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!res.ok) {
              setError(data.error || 'Failed to book appointment');
              setIsSubmitting(false);
              return;
          }

          // If online payment selected, initiate SSLCommerz payment immediately
          if (paymentMethod === 'online' && data.appointment?.id) {
              setPaymentRedirecting(true);
              const payRes = await fetch('/api/payment/initiate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ appointment_id: data.appointment.id })
              });
              const payData = await payRes.json();
              if (payRes.ok && payData.gatewayUrl) {
                  window.location.href = payData.gatewayUrl;
                  return;
              } else {
                  setError(payData.error || 'Appointment reserved, but failed to connect to payment portal.');
                  setSuccessData(data);
                  setShowSuccessModal(true);
                  setPaymentRedirecting(false);
                  setIsSubmitting(false);
                  return;
              }
          }

          setSuccessData(data);
          setShowSuccessModal(true);
          setIsSubmitting(false);
      } catch (err: any) {
          setError(err.message);
          setIsSubmitting(false);
          setPaymentRedirecting(false);
      }
  };

  useEffect(() => {
    fetch('/api/specialities')
      .then(r => r.json())
      .then(data => {
         if (Array.isArray(data)) setSpecialities(data as any);
      });
  }, []);

  useEffect(() => {
    setDoctorsLoading(true);
    const url = selectedSpeciality ? `/api/doctors?speciality_id=${selectedSpeciality}` : '/api/doctors';
    fetch(url)
      .then(r => r.json())
      .then(data => {
         if (Array.isArray(data)) setDoctors(data as any);
         else setDoctors([]);
      })
      .catch(() => setDoctors([]))
      .finally(() => setDoctorsLoading(false));
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
  
  const handleNext = () => {
      if (!selectedDoctorId || !selectedDate || !selectedSlot) return;
      setStep(2);
      setError('');
      setSuccess('');
  };
  
  const handleSubmitAppointment = async () => {
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
              setStep(1);
          } else {
              setError(data.error || 'Failed to book appointment');
          }
      } catch (err: any) {
          setError(err.message);
      }
  };
  
  const daysMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const renderPaymentOptions = () => (
      <div className="border p-3 mb-4 rounded-0 bg-light text-start shadow-xs">
          <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <span className="fw-bold small text-dark">
                  Doctor Consultation Fee
              </span>
              <span className="fw-bold fs-5 text-success">
                  {doctorDetails ? `BDT ${doctorDetails.consultation_fee || 1200}` : 'BDT 1,200'}
              </span>
          </div>
          <label className="small fw-bold text-dark d-block mb-2">Select Payment Option:</label>
          <div className="form-check mb-2 p-2 border bg-white rounded-0">
              <input 
                  className="form-check-input ms-1 me-2" 
                  type="radio" 
                  name="paymentMethod" 
                  id="payOnline" 
                  checked={paymentMethod === 'online'} 
                  onChange={() => setPaymentMethod('online')} 
              />
              <label className="form-check-label small fw-semibold text-dark" htmlFor="payOnline" style={{ cursor: 'pointer' }}>
                  Pay Online via SSLCommerz
                  <span className="badge bg-success ms-2 py-1 px-2" style={{ fontSize: '10px' }}>Recommended</span>
                  <span className="d-block text-muted fw-normal mt-1" style={{ fontSize: '12px' }}>
                      Cards (Visa, Mastercard, Amex), Mobile Banking (bKash, Nagad, Rocket) & Net Banking
                  </span>
              </label>
          </div>
          <div className="form-check p-2 border bg-white rounded-0">
              <input 
                  className="form-check-input ms-1 me-2" 
                  type="radio" 
                  name="paymentMethod" 
                  id="payCounter" 
                  checked={paymentMethod === 'counter'} 
                  onChange={() => setPaymentMethod('counter')} 
              />
              <label className="form-check-label small fw-semibold text-dark" htmlFor="payCounter" style={{ cursor: 'pointer' }}>
                  Pay at Hospital Counter
                  <span className="d-block text-muted fw-normal mt-1" style={{ fontSize: '12px' }}>
                      Pay cash at the hospital counter on the day of consultation
                  </span>
              </label>
          </div>
      </div>
  );


  if (step === 2) {
      let specName = '';
      const selSpec: any = specialities.find((s: any) => String(s.id) === String(selectedSpeciality));
      if (selSpec) specName = selSpec.name.toUpperCase();
      
      let docName = doctorDetails?.full_name?.toUpperCase() || '';
      
      let dateFmt = '';
      let dayOfWeek = '';
      try {
          const d = parse(selectedDate, 'yyyy-MM-dd', new Date());
          dateFmt = format(d, 'dd/MM/yyyy');
          dayOfWeek = format(d, 'EEEE');
      } catch(e) {}
      
      let timeFmt = selectedSlot;
      try {
          timeFmt = format(parse(selectedSlot, 'HH:mm:ss', new Date()), 'hh:mm a');
      } catch(e) {}

      return (
          <div className="container py-4">
              {/* Header Match (dashboard only; the public page uses the site header) */}
              {isDashboard && (<div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '1px solid #E3EAF3' }}>
                 <a href="/" className="logo d-flex align-items-center text-decoration-none">
                    <h1 className="sitename m-0" style={{ fontSize: '32px', color: '#1B2978' }}>Clinic</h1>
                 </a>
                 <h3 className="m-0" style={{ color: '#1B2978' }}>Book an Appointment</h3>
              </div>)}
              <div className="p-3 text-white mb-2" style={{ backgroundColor: '#3346B5', fontSize: '15px' }}>
                  Appointment for Speciality: {specName} Doctor: {docName} on {dateFmt} {timeFmt} ( {dayOfWeek} )
              </div>
              
              {!isDashboard && (
              <div className="p-3 text-white mb-4 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#3346B5' }}>
                  <h5 className="m-0 fw-bold" style={{ fontSize: '16px' }}>Patient Details</h5>
                  <div>
                      <button className="btn rounded-0 text-white border-0 me-2 px-3 fw-bold" style={{ backgroundColor: patientType === 'OLD' ? '#5c5c5c' : '#737373', fontSize: '14px' }} onClick={() => setPatientType('OLD')}>OLD Patient</button>
                      <button className="btn rounded-0 text-white border-0 px-3 fw-bold" style={{ backgroundColor: patientType === 'NEW' ? '#5c5c5c' : '#737373', fontSize: '14px' }} onClick={() => setPatientType('NEW')}>NEW Patient</button>
                  </div>
              </div>
              )}

              <div className="bg-white p-4" style={{ minHeight: '400px' }}>
                  {error && <div className="alert alert-danger rounded-0 py-2">{error}</div>}
                  {success && <div className="alert alert-success rounded-0 py-2">{success}</div>}
                  
                  {isDashboard ? (
                      <div className="row justify-content-center">
                          <div className="col-md-8 text-center mb-4 pt-3">
                              <h5 className="mb-3">Select Family Member for Appointment</h5>
                              <select className="form-select rounded-0 border-secondary-subtle mb-4" value={selectedOldPatientId} onChange={e => setSelectedOldPatientId(e.target.value)}>
                                  <option value="">-- Select Patient --</option>
                                  {userPatients?.map(p => (
                                      <option key={p.id} value={p.id}>{p.full_name} ({p.uhid})</option>
                                  ))}
                              </select>
                              {renderPaymentOptions()}
                              <div className="d-flex justify-content-center">
                                  <button className="btn text-white rounded-0 px-4 me-2" style={{ backgroundColor: '#3346B5' }} onClick={() => setStep(1)} disabled={isSubmitting}>Back</button>
                                  <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#1B2978' }} onClick={handleSubmitAppointmentNew} disabled={!selectedOldPatientId || isSubmitting}>
                                      {isSubmitting ? 'Processing...' : (paymentMethod === 'online' ? 'Proceed to Payment' : 'Confirm Appointment')}
                                  </button>
                              </div>
                          </div>
                      </div>
                  ) : patientType === 'OLD' ? (
                      <div className="row justify-content-center">
                          <div className="col-md-8">
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-4 text-end">
                                      <div className="form-check form-check-inline">
                                          <input className="form-check-input" type="radio" name="oldSearchType" id="searchMobile" checked={oldSearch.type === 'mobile'} onChange={() => setOldSearch({ ...oldSearch, type: 'mobile' })} />
                                          <label className="form-check-label small" htmlFor="searchMobile">Mobile</label>
                                      </div>
                                      <div className="form-check form-check-inline">
                                          <input className="form-check-input" type="radio" name="oldSearchType" id="searchUHID" checked={oldSearch.type === 'uhid'} onChange={() => setOldSearch({ ...oldSearch, type: 'uhid' })} />
                                          <label className="form-check-label small" htmlFor="searchUHID">UHID</label>
                                      </div>
                                  </div>
                                  <div className="col-md-5">
                                      <input type="text" className="form-control rounded-0 border-secondary-subtle" placeholder={oldSearch.type === 'mobile' ? "Enter your mobile number" : "Enter your UHID"} value={oldSearch.q} onChange={(e) => setOldSearch({ ...oldSearch, q: e.target.value })} />
                                  </div>
                                  <div className="col-md-3">
                                      <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#3346B5' }} onClick={searchOldPatient}>Go</button>
                                  </div>
                              </div>
                              
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-4 text-end">
                                      <label className="small mb-0">Patient Name <span className="text-danger">*</span></label>
                                  </div>
                                  <div className="col-md-8">
                                      <select className="form-select rounded-0 border-secondary-subtle" value={selectedOldPatientId} onChange={(e) => setSelectedOldPatientId(e.target.value)}>
                                          <option value="">select patient for whom appointment is needed</option>
                                          {oldPatientsList.map(p => (
                                              <option key={p.id} value={p.id}>{p.full_name} ({p.uhid || p.mobile_no})</option>
                                          ))}
                                      </select>
                                  </div>
                              </div>

                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-4 text-end">
                                      <label className="small mb-0">Gender</label>
                                  </div>
                                  <div className="col-md-8">
                                      <input type="text" className="form-control rounded-0 border-secondary-subtle bg-light" disabled value={oldPatientsList.find(p => p.id === selectedOldPatientId)?.gender || ''} />
                                  </div>
                              </div>
                              
                              <div className="row mb-4 align-items-center">
                                  <div className="col-md-4 text-end">
                                      <label className="small mb-0">Email Id</label>
                                  </div>
                                  <div className="col-md-8">
                                      <input type="email" className="form-control rounded-0 border-secondary-subtle bg-light" disabled value={oldPatientsList.find(p => p.id === selectedOldPatientId)?.email || ''} />
                                  </div>
                              </div>

                              <div className="row mb-3">
                                  <div className="col-md-8 offset-md-4">
                                      {renderPaymentOptions()}
                                  </div>
                              </div>
                              
                              <div className="row">
                                  <div className="col-md-8 offset-md-4 d-flex justify-content-end">
                                      <button className="btn text-white rounded-0 me-2 px-4" style={{ backgroundColor: '#3346B5' }} onClick={() => setStep(1)} disabled={isSubmitting}>Back</button>
                                      <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#1B2978' }} onClick={handleSubmitAppointmentNew} disabled={isSubmitting || !selectedOldPatientId}>
                                          {isSubmitting ? 'Processing...' : (paymentMethod === 'online' ? 'Proceed to Payment' : 'Confirm Appointment')}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="row justify-content-center">
                          <div className="col-md-8">
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Title <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9">
                                      <select className="form-select rounded-0 border-secondary-subtle" value={newPatientForm.title} onChange={e => setNewPatientForm({...newPatientForm, title: e.target.value})}>
                                          <option value="">[Select Title]</option>
                                          <option value="Mr.">Mr.</option>
                                          <option value="Ms.">Ms.</option>
                                          <option value="Mrs.">Mrs.</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Patient Name <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9">
                                      <input type="text" className="form-control rounded-0 border-secondary-subtle" placeholder="Please Enter First Name" value={newPatientForm.full_name} onChange={e => setNewPatientForm({...newPatientForm, full_name: e.target.value})} />
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Father/Spouse Name</label></div>
                                  <div className="col-md-9">
                                      <input type="text" className="form-control rounded-0 border-secondary-subtle" placeholder="Please Enter Father/Spouse Name" value={newPatientForm.father_name} onChange={e => setNewPatientForm({...newPatientForm, father_name: e.target.value})} />
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Gender <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9">
                                      <select className="form-select rounded-0 border-secondary-subtle" value={newPatientForm.gender} onChange={e => setNewPatientForm({...newPatientForm, gender: e.target.value})}>
                                          <option value="Male">Male</option>
                                          <option value="Female">Female</option>
                                          <option value="Other">Other</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">DOB</label></div>
                                  <div className="col-md-4">
                                      <input type="date" className="form-control rounded-0 border-secondary-subtle" max={new Date().toISOString().split('T')[0]} value={newPatientForm.dob} onChange={handleDobChange} />
                                  </div>
                                  <div className="col-md-5 d-flex align-items-center gap-2">
                                      <span className="small">Age</span>
                                      <input type="text" className="form-control rounded-0 border-secondary-subtle px-1 text-center" placeholder="Y" style={{ width: '40px' }} value={newPatientForm.ageY} onChange={e => handleAgeChange('ageY', e.target.value)} />
                                      <span className="small">Y</span>
                                      <input type="text" className="form-control rounded-0 border-secondary-subtle px-1 text-center" placeholder="M" style={{ width: '40px' }} value={newPatientForm.ageM} onChange={e => handleAgeChange('ageM', e.target.value)} />
                                      <span className="small">M</span>
                                      <input type="text" className="form-control rounded-0 border-secondary-subtle px-1 text-center" placeholder="D" style={{ width: '40px' }} value={newPatientForm.ageD} onChange={e => handleAgeChange('ageD', e.target.value)} />
                                      <span className="small">D</span>
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Mobile No. <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9">
                                      <input type="text" maxLength={14} className="form-control rounded-0 border-secondary-subtle" placeholder="+8801XXXXXXXXX" value={newPatientForm.mobile_no} onChange={e => setNewPatientForm({...newPatientForm, mobile_no: e.target.value})} />
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Email</label></div>
                                  <div className="col-md-9">
                                      <input type="email" className="form-control rounded-0 border-secondary-subtle" placeholder="Email Id" value={newPatientForm.email} onChange={e => setNewPatientForm({...newPatientForm, email: e.target.value})} />
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Address</label></div>
                                  <div className="col-md-9">
                                      <input type="text" className="form-control rounded-0 border-secondary-subtle" placeholder="Type here" value={newPatientForm.address} onChange={e => setNewPatientForm({...newPatientForm, address: e.target.value})} />
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Country</label></div>
                                  <div className="col-md-9">
                                      <select className="form-select rounded-0 border-secondary-subtle" value={newPatientForm.country} onChange={e => setNewPatientForm({...newPatientForm, country: e.target.value})}>
                                          <option value="">-Select-</option>
                                          <option value="Bangladesh">Bangladesh</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">State</label></div>
                                  <div className="col-md-9">
                                      <select className="form-select rounded-0 border-secondary-subtle" value={newPatientForm.state} onChange={e => setNewPatientForm({...newPatientForm, state: e.target.value})}>
                                          <option value="">-Select-</option>
                                          <option value="Dhaka">Dhaka</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="row mb-4 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">City</label></div>
                                  <div className="col-md-9">
                                      <select className="form-select rounded-0 border-secondary-subtle" value={newPatientForm.city} onChange={e => setNewPatientForm({...newPatientForm, city: e.target.value})}>
                                          <option value="">-Select-</option>
                                          <option value="Dhaka">Dhaka</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="row mb-3">
                                  <div className="col-md-9 offset-md-3">
                                      {renderPaymentOptions()}
                                  </div>
                              </div>
                              <div className="row">
                                  <div className="col-md-9 offset-md-3 d-flex justify-content-end">
                                      <button className="btn text-white rounded-0 me-2 px-4" style={{ backgroundColor: '#3346B5' }} onClick={() => setStep(1)} disabled={isSubmitting}>Back</button>
                                      <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#1B2978' }} onClick={handleSubmitAppointmentNew} disabled={isSubmitting}>
                                          {isSubmitting ? 'Processing...' : (paymentMethod === 'online' ? 'Proceed to Payment' : 'Confirm Appointment')}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>

              {showSuccessModal && (
                  <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                      <div className="modal-dialog modal-dialog-centered">
                          <div className="modal-content rounded-0 border-0">
                              <div className="modal-header text-white" style={{ backgroundColor: '#3346B5' }}>
                                  <h5 className="modal-title">Booking Successful</h5>
                                  <button type="button" className="btn-close btn-close-white" onClick={() => {
                                      setShowSuccessModal(false);
                                      window.location.href = isDashboard ? '/patient/appointments' : '/';
                                  }}></button>
                              </div>
                              <div className="modal-body text-center py-4">
                                  <h4 className="text-success mb-3">Booking Confirmed</h4>
                                  <p className="mb-2">Your appointment has been successfully scheduled.</p>
                                  
                                  <div className="alert alert-success rounded-0 my-3 text-start">
                                      <p className="mb-1"><strong>Doctor:</strong> {doctors.find((d: any) => d.id === selectedDoctorId)?.full_name}</p>
                                      <p className="mb-1"><strong>Date:</strong> {selectedDate}</p>
                                      <p className="mb-1"><strong>Time:</strong> {selectedSlot}</p>
                                      <p className="mb-1"><strong>Serial No:</strong> <span className="fs-5 fw-bold">{successData?.appointment?.serial_no || '-'}</span></p>
                                  </div>

                                  {patientType === 'NEW' && (
                                    <div className="alert alert-info rounded-0 my-3 text-start">
                                        <p className="mb-1"><strong>Your UHID:</strong> {successData?.uhid}</p>
                                        <p className="mb-0"><strong>Your Login PIN:</strong> {successData?.pin}</p>
                                        <small className="text-muted d-block mt-2">Please remember this PIN for future logins.</small>
                                    </div>
                                  )}

                                  <div className="d-flex justify-content-center gap-2 mt-3">
                                      {successData?.appointment?.id && (
                                          <button
                                              className="btn btn-outline-success rounded-0 px-3"
                                              onClick={async () => {
                                                  setPaymentRedirecting(true);
                                                  const payRes = await fetch('/api/payment/initiate', {
                                                      method: 'POST',
                                                      headers: { 'Content-Type': 'application/json' },
                                                      body: JSON.stringify({ appointment_id: successData.appointment.id })
                                                  });
                                                  const payData = await payRes.json();
                                                  if (payData.gatewayUrl) {
                                                      window.location.href = payData.gatewayUrl;
                                                  } else {
                                                      setPaymentRedirecting(false);
                                                      alert(payData.error || 'Failed to initiate payment');
                                                  }
                                              }}
                                          >
                                              Pay Online Now
                                          </button>
                                      )}
                                      <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#1B2978' }} onClick={() => {
                                          setShowSuccessModal(false);
                                          window.location.href = isDashboard ? '/patient/appointments' : '/';
                                      }}>View Appointments</button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {paymentRedirecting && (
                  <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1070 }}>
                      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '420px' }}>
                          <div className="modal-content rounded-0 border-0 p-4 text-center shadow-lg">
                              <div className="spinner-border mx-auto mb-3" role="status" style={{ width: '3rem', height: '3rem', color: '#1B2978' }}>
                                  <span className="visually-hidden">Loading...</span>
                              </div>
                              <h5 className="fw-bold mb-1" style={{ color: '#1B2978' }}>Redirecting to SSLCommerz</h5>
                              <p className="text-muted small mb-0">Connecting to secure payment gateway. Please wait...</p>
                          </div>
                      </div>
                  </div>
              )}
          </div>

      );
  }
  
  return (
    <div className="container py-4 cl-book">
      {/* Header Match (dashboard only; the public page uses the site header) */}
      {isDashboard && (<div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '1px solid #E3EAF3' }}>
         <a href="/" className="logo d-flex align-items-center text-decoration-none">
            <h1 className="sitename m-0" style={{ fontSize: '32px', color: '#1B2978' }}>Clinic</h1>
         </a>
         <h3 className="m-0" style={{ color: '#1B2978' }}>Book an Appointment</h3>
      </div>)}
      
      <div className="row g-4">
         {/* Left Panel */}
         <div className="col-md-4">
            <div className="card cl-book-doctor mb-4">
                <div className="card-header text-white py-4">
                   <div className="d-flex align-items-center">
                       <div className="bg-white rounded-circle me-3 overflow-hidden d-flex justify-content-center align-items-center flex-shrink-0" style={{ width: '72px', height: '72px' }}>
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
                   <h6 className="cl-book-eyebrow mb-3"><i className="bi bi-hospital me-2"></i>LABAID CARDIAC HOSPITAL :</h6>
                   {doctorDetails?.schedules && doctorDetails.schedules.length > 0 ? (
                       <ul className="list-unstyled mb-0 cl-book-schedule">
                          {doctorDetails.schedules.map((s: any, i: number) => {
                              const formatTime = (t: string) => format(parse(t, 'HH:mm:ss', new Date()), 'h:mm a');
                              const start = formatTime(s.start_time);
                              const end = formatTime(s.end_time);
                              return (
                                  <li key={i}>
                                     <i className="bi bi-clock me-2"></i>{daysMap[s.day_of_week]}: {start} - {end}
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
         <div className="col-md-8">
          <div className="card cl-book-form">
            {error && <div className="alert alert-danger py-2">{error}</div>}
            {success && <div className="alert alert-success py-2">{success}</div>}
         
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
                  <label className="form-label small mb-1">
                     Select Doctor <span className="text-danger">*</span>
                     {selectedSpeciality && !doctorsLoading && (
                        <span className="text-muted ms-1" style={{ fontSize: '11px' }}>
                           ({doctors.length} {doctors.length === 1 ? 'doctor' : 'doctors'} available)
                        </span>
                     )}
                  </label>
                  <select 
                     suppressHydrationWarning 
                     className="form-select rounded-0 border-secondary-subtle" 
                     value={selectedDoctorId} 
                     onChange={e => setSelectedDoctorId(e.target.value)} 
                     disabled={doctorsLoading || (doctors.length === 0 && !selectedSpeciality)}
                  >
                     <option value="">
                        {doctorsLoading 
                           ? '-- Loading Doctors... --' 
                           : doctors.length === 0 && selectedSpeciality
                              ? '-- No Doctors Available --'
                              : '-- Select --'}
                     </option>
                     {doctors.map((d: any) => (
                         <option key={d.id} value={d.id}>{d.full_name.toUpperCase()}</option>
                     ))}
                  </select>
               </div>
               <div className="col-md-6">
                  <label className="form-label small mb-1">Appointment Date <span className="text-danger">*</span></label>
                  <input suppressHydrationWarning type="date" className="form-control rounded-0 border-secondary-subtle" value={selectedDate} min={todayStr} onChange={e => setSelectedDate(e.target.value)} />
               </div>
               <div className="col-md-6">
                  <label className="form-label small mb-1">Consultation<span className="text-danger">*</span></label>
                  <div className="form-control cl-book-fee">
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
                                className={`cl-book-slot ${
                                    slot.start_time === selectedSlot ? 'text-white fw-bold' : 
                                    slot.available ? 'bg-white' : 'bg-light text-muted text-decoration-line-through opacity-50'
                                }`}
                                style={{ 
                                    ...(slot.start_time === selectedSlot ? { backgroundColor: '#1B2978', borderColor: '#1B2978' } : 
                                        slot.available ? { borderColor: '#1B2978', color: '#1B2978' } : 
                                        {})
                                }}
                            >
                                {slot.time}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="cl-book-notice"><i className="bi bi-telephone me-2"></i>Please call at 10606 for appointment booking.</p>
                )
            ) : (
                <p className="cl-book-notice"><i className="bi bi-telephone me-2"></i>Please call at 10606 for appointment booking.</p>
            )}
            
            {/* Bottom Actions */}
            <div className="d-flex justify-content-end gap-2 mt-4 pt-4 cl-book-actions">
               <button className="btn dss-outline px-4" onClick={handleReset}>Reset</button>
               <button className={`btn text-white px-4 ${(!selectedDoctorId || !selectedDate || !selectedSlot) ? 'opacity-50' : ''}`} style={{ backgroundColor: '#1B2978', borderColor: '#1B2978' }} disabled={!selectedDoctorId || !selectedDate || !selectedSlot} onClick={handleNext}>Next</button>
            </div>
          </div>
         </div>
      </div>
    </div>
  );
}
