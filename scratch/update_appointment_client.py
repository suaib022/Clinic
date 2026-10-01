import re

with open("app/appointment/AppointmentClient.tsx", "r") as f:
    content = f.read()

# 1. Add state variables
state_add = """  const [todayStr, setTodayStr] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  
  const [step, setStep] = useState<1 | 2>(1);
  const [patientType, setPatientType] = useState<'OLD' | 'NEW'>('OLD');"""
content = content.replace("  const [todayStr, setTodayStr] = useState('');\n  const [selectedDate, setSelectedDate] = useState('');", state_add)

# 2. Replace handleNext with two functions
old_handle_next = """  const handleNext = async () => {
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
  };"""

new_handle_next = """  const handleNext = () => {
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
  };"""
content = content.replace(old_handle_next, new_handle_next)

# 3. Add renderStep2 logic before the return
step2_logic = """
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
              <div className="p-3 text-white mb-2" style={{ backgroundColor: '#0ab1a9', fontSize: '15px' }}>
                  Appointment for Speciality: {specName} Doctor: {docName} on {dateFmt} {timeFmt} ( {dayOfWeek} )
              </div>
              
              <div className="p-3 text-white mb-4 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#0ab1a9' }}>
                  <h5 className="m-0 fw-bold" style={{ fontSize: '16px' }}>Patient Details</h5>
                  <div>
                      <button className="btn rounded-0 text-white border-0 me-2 px-3 fw-bold" style={{ backgroundColor: patientType === 'OLD' ? '#5c5c5c' : '#737373', fontSize: '14px' }} onClick={() => setPatientType('OLD')}>OLD Patient</button>
                      <button className="btn rounded-0 text-white border-0 px-3 fw-bold" style={{ backgroundColor: patientType === 'NEW' ? '#5c5c5c' : '#737373', fontSize: '14px' }} onClick={() => setPatientType('NEW')}>NEW Patient</button>
                  </div>
              </div>

              <div className="bg-white p-4" style={{ minHeight: '400px' }}>
                  {error && <div className="alert alert-danger rounded-0 py-2">{error}</div>}
                  {success && <div className="alert alert-success rounded-0 py-2">{success}</div>}
                  
                  {patientType === 'OLD' ? (
                      <div className="row justify-content-center">
                          <div className="col-md-8">
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-4 text-end">
                                      <div className="form-check form-check-inline">
                                          <input className="form-check-input" type="radio" name="oldSearchType" id="searchMobile" defaultChecked />
                                          <label className="form-check-label small" htmlFor="searchMobile">Mobile</label>
                                      </div>
                                      <div className="form-check form-check-inline">
                                          <input className="form-check-input" type="radio" name="oldSearchType" id="searchUHID" />
                                          <label className="form-check-label small" htmlFor="searchUHID">UHID</label>
                                      </div>
                                  </div>
                                  <div className="col-md-5">
                                      <input type="text" className="form-control rounded-0 border-secondary-subtle" placeholder="Enter your mobile number" />
                                  </div>
                                  <div className="col-md-3">
                                      <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#0ab1a9' }}>Go</button>
                                  </div>
                              </div>
                              
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-4 text-end">
                                      <label className="small mb-0">Patient Name <span className="text-danger">*</span></label>
                                  </div>
                                  <div className="col-md-8">
                                      <select className="form-select rounded-0 border-secondary-subtle">
                                          <option>select patient for whom appointment is needed</option>
                                      </select>
                                  </div>
                              </div>
                              
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-4 text-end">
                                      <label className="small mb-0">Gender <span className="text-danger">*</span></label>
                                  </div>
                                  <div className="col-md-8">
                                      <select className="form-select rounded-0 border-secondary-subtle">
                                          <option>Male</option>
                                          <option>Female</option>
                                          <option>Other</option>
                                      </select>
                                  </div>
                              </div>
                              
                              <div className="row mb-4 align-items-center">
                                  <div className="col-md-4 text-end">
                                      <label className="small mb-0">Email Id</label>
                                  </div>
                                  <div className="col-md-8">
                                      <input type="email" className="form-control rounded-0 border-secondary-subtle" />
                                  </div>
                              </div>
                              
                              <div className="row">
                                  <div className="col-md-8 offset-md-4 d-flex justify-content-end">
                                      <button className="btn text-white rounded-0 me-2 px-4" style={{ backgroundColor: '#0ab1a9' }} onClick={() => setStep(1)}>Back</button>
                                      <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#0ab1a9' }} onClick={handleSubmitAppointment}>Submit</button>
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
                                      <select className="form-select rounded-0 border-secondary-subtle">
                                          <option>[Select Title]</option>
                                          <option>Mr.</option>
                                          <option>Ms.</option>
                                          <option>Mrs.</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Patient Name <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9"><input type="text" className="form-control rounded-0 border-secondary-subtle" /></div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Father Name <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9"><input type="text" className="form-control rounded-0 border-secondary-subtle" /></div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Gender <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9">
                                      <select className="form-select rounded-0 border-secondary-subtle">
                                          <option>--Select Gender--</option>
                                          <option>Male</option>
                                          <option>Female</option>
                                          <option>Other</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">DOB <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9"><input type="date" className="form-control rounded-0 border-secondary-subtle" /></div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Age(Y-M-D)</label></div>
                                  <div className="col-md-9">
                                      <div className="d-flex gap-2">
                                          <input type="number" className="form-control rounded-0 border-secondary-subtle w-100" placeholder="Y" />
                                          <input type="number" className="form-control rounded-0 border-secondary-subtle w-100" placeholder="M" />
                                          <input type="number" className="form-control rounded-0 border-secondary-subtle w-100" placeholder="D" />
                                      </div>
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Mobile No <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9"><input type="text" className="form-control rounded-0 border-secondary-subtle" /></div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Email Id</label></div>
                                  <div className="col-md-9"><input type="email" className="form-control rounded-0 border-secondary-subtle" /></div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Address <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9"><input type="text" className="form-control rounded-0 border-secondary-subtle" /></div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">Country <span className="text-danger">*</span></label></div>
                                  <div className="col-md-9">
                                      <select className="form-select rounded-0 border-secondary-subtle">
                                          <option>BANGLADESH</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="row mb-3 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">State</label></div>
                                  <div className="col-md-9">
                                      <select className="form-select rounded-0 border-secondary-subtle">
                                          <option>DHAKA</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="row mb-4 align-items-center">
                                  <div className="col-md-3 text-end"><label className="small mb-0">City</label></div>
                                  <div className="col-md-9">
                                      <select className="form-select rounded-0 border-secondary-subtle">
                                          <option>Select City</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="row">
                                  <div className="col-md-9 offset-md-3 d-flex justify-content-end">
                                      <button className="btn text-white rounded-0 me-2 px-4" style={{ backgroundColor: '#0ab1a9' }} onClick={() => setStep(1)}>Back</button>
                                      <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#0ab1a9' }} onClick={handleSubmitAppointment}>Submit</button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      );
  }
  
  return (
"""
content = content.replace("  return (\n    <div className=\"container py-4\">", step2_logic + "    <div className=\"container py-4\">")

with open("app/appointment/AppointmentClient.tsx", "w") as f:
    f.write(content)
print("Updated successfully")
