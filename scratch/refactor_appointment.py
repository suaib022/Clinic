import re

with open('app/appointment/AppointmentClient.tsx', 'r') as f:
    content = f.read()

# Add imports
imports_to_add = """import { addMinutes, differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths, subYears, subMonths, subDays } from 'date-fns';
"""
content = content.replace("import { format, parse, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';", "import { format, parse, startOfWeek, endOfWeek, addDays, isSameDay, differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths, subYears, subMonths, subDays } from 'date-fns';")

# Add states
states_to_add = """
    const [newPatientForm, setNewPatientForm] = useState({
        title: '', full_name: '', father_name: '', gender: 'Male', dob: '', 
        ageY: '', ageM: '', ageD: '', mobile_no: '', email: '', 
        address: '', country: '', state: '', city: ''
    });
    const [oldSearch, setOldSearch] = useState({ type: 'mobile', q: '' });
    const [oldPatientsList, setOldPatientsList] = useState<any[]>([]);
    const [selectedOldPatientId, setSelectedOldPatientId] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successData, setSuccessData] = useState<any>(null);

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
        if (!selectedSpeciality || !selectedDoctor || !selectedDate || !selectedSlot) {
            setError('Please select all appointment details in step 1');
            return;
        }
        setError(null);
        setSuccess(null);
        try {
            let payload: any = {
                doctor_id: selectedDoctor,
                appointment_date: selectedDate,
                start_time: selectedSlot,
                patientType: patientType
            };
            if (patientType === 'NEW') {
                if (!newPatientForm.full_name || !newPatientForm.mobile_no || !newPatientForm.title) {
                    setError('Please fill all mandatory fields (Title, Name, Mobile)');
                    return;
                }
                payload.patientData = newPatientForm;
            } else {
                if (!selectedOldPatientId) {
                    setError('Please select an old patient');
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
            if (res.ok) {
                if (patientType === 'NEW') {
                    setSuccessData(data);
                    setShowSuccessModal(true);
                } else {
                    setSuccess('Appointment requested successfully and is on hold!');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 3000);
                }
            } else {
                setError(data.error || 'Failed to book appointment');
            }
        } catch (err: any) {
            setError(err.message);
        }
    };
"""

content = content.replace("const [patientType, setPatientType] = useState('OLD');", "const [patientType, setPatientType] = useState('OLD');\n" + states_to_add)

# Update OLD patient form UI
old_patient_ui = """
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
                                      <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#0ab1a9' }} onClick={searchOldPatient}>Go</button>
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
                              
                              <div className="row">
                                  <div className="col-md-8 offset-md-4 d-flex justify-content-end">
                                      <button className="btn text-white rounded-0 me-2 px-4" style={{ backgroundColor: '#0ab1a9' }} onClick={() => setStep(1)}>Back</button>
                                      <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#0ab1a9' }} onClick={handleSubmitAppointmentNew}>Submit</button>
"""

content = re.sub(
    r'<div className="form-check form-check-inline">.*?onClick=\{handleSubmitAppointment\}>Submit</button>',
    old_patient_ui.strip(),
    content,
    flags=re.DOTALL
)

# Update NEW patient form UI
new_patient_ui = """
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
                                      <input type="date" className="form-control rounded-0 border-secondary-subtle" value={newPatientForm.dob} onChange={handleDobChange} />
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
                                      <input type="text" className="form-control rounded-0 border-secondary-subtle" placeholder="Mobile Number" value={newPatientForm.mobile_no} onChange={e => setNewPatientForm({...newPatientForm, mobile_no: e.target.value})} />
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
                              <div className="row">
                                  <div className="col-md-9 offset-md-3 d-flex justify-content-end">
                                      <button className="btn text-white rounded-0 me-2 px-4" style={{ backgroundColor: '#0ab1a9' }} onClick={() => setStep(1)}>Back</button>
                                      <button className="btn text-white rounded-0 px-4" style={{ backgroundColor: '#0ab1a9' }} onClick={handleSubmitAppointmentNew}>Submit</button>
"""

content = re.sub(
    r'<div className="col-md-3 text-end"><label className="small mb-0">Title <span className="text-danger">\*</span></label></div>.*?onClick=\{handleSubmitAppointment\}>Submit</button>',
    new_patient_ui.strip(),
    content,
    flags=re.DOTALL
)

# Add Success Modal logic at the end before final div closing of container
modal_ui = """
              {showSuccessModal && (
                  <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                      <div className="modal-dialog modal-dialog-centered">
                          <div className="modal-content rounded-0 border-0">
                              <div className="modal-header text-white" style={{ backgroundColor: '#0ab1a9' }}>
                                  <h5 className="modal-title">Booking Successful</h5>
                                  <button type="button" className="btn-close btn-close-white" onClick={() => {
                                      setShowSuccessModal(false);
                                      window.location.href = '/';
                                  }}></button>
                              </div>
                              <div className="modal-body text-center py-4">
                                  <h4 className="text-success mb-3">Appointment Requested</h4>
                                  <p className="mb-2">Your appointment is currently on <strong>hold</strong> waiting for admin approval.</p>
                                  <div className="alert alert-info rounded-0 my-3 text-start">
                                      <p className="mb-1"><strong>Your UHID:</strong> {successData?.uhid}</p>
                                      <p className="mb-0"><strong>Your Login PIN:</strong> {successData?.pin}</p>
                                      <small className="text-muted d-block mt-2">Please remember this PIN for future logins (OTP will be added later).</small>
                                  </div>
                                  <button className="btn text-white rounded-0 px-4 mt-2" style={{ backgroundColor: '#0ab1a9' }} onClick={() => {
                                      setShowSuccessModal(false);
                                      window.location.href = '/';
                                  }}>Done</button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
"""

content = content.replace("          </div>\n      );\n  }", modal_ui + "\n      );\n  }")

with open('app/appointment/AppointmentClient.tsx', 'w') as f:
    f.write(content)

