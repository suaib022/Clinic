import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import ProfileForms from './ProfileForms';
import { requireRole } from '@/lib/auth/requireRole';

export default async function DoctorProfilePage() {
    const cookieStore = await cookies();
    
    // Basic auth check
    const { user: authUser, role: staffRole } = await requireRole(['admin', 'doctor', 'compounder']);


    const supabase = await createClient();
    
    // Fetch user and doctor profile
    const { data: user } = await supabase
        .from('users')
        .select(`
            id,
            full_name,
            email,
            doctors (
                doctor_id,
                consultation_fee,
                avatar_url
            ),
            legacy_doctors (
                name,
                designation,
                hospital,
                image_url
            )
        `)
        .eq('id', authUser.id)
        .single();

    const doctorProfile = (user?.doctors?.[0] || user?.doctors || {}) as any;
    const legacyDetails = (user?.legacy_doctors?.[0] || user?.legacy_doctors || {}) as any;
    
    const doctorDetails = { ...legacyDetails, ...doctorProfile };
    const fullName = user?.full_name || legacyDetails?.name || 'Doctor';
    const avatar = legacyDetails?.image_url || doctorProfile?.avatar_url || 'https://via.placeholder.com/150';
    const designation = legacyDetails?.designation || 'Doctor';
    const hospital = legacyDetails?.hospital || 'N/A';


    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="doctor" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>My Profile</h2>
                        </div>
                        
                        <div className="card border-0 shadow-sm rounded-0">
                            <div className="card-body p-5">
                                <div className="row">
                                    <div className="col-md-4 text-center">
                                        <img 
                                            src={avatar} 
                                            alt={fullName} 
                                            className="rounded-circle mb-3 border" 
                                            style={{ width: '180px', height: '180px', objectFit: 'cover', borderColor: '#0ab1a9 !important', borderWidth: '3px !important' }} 
                                        />
                                        <h4 className="fw-bold">{fullName}</h4>
                                        <p className="text-muted mb-1">{designation}</p>
                                        <span className="badge bg-light text-dark border px-3 py-2 mt-2">
                                            ID: {doctorProfile?.doctor_id}
                                        </span>
                                    </div>
                                    <div className="col-md-8">
                                        <h5 className="mb-4" style={{ color: '#0D7D72' }}>Personal Information</h5>
                                        <table className="table table-borderless">
                                            <tbody>
                                                <tr>
                                                    <th className="ps-0" style={{ width: '30%' }}>Full Name:</th>
                                                    <td>{fullName}</td>
                                                </tr>
                                                <tr>
                                                    <th className="ps-0">Email Address:</th>
                                                    <td>{user?.email || 'N/A'}</td>
                                                </tr>
                                                <tr>
                                                    <th className="ps-0">Hospital:</th>
                                                    <td>{hospital}</td>
                                                </tr>
                                                <tr>
                                                    <th className="ps-0">Consultation Fee:</th>
                                                    <td>{doctorProfile?.consultation_fee ? `$${doctorProfile.consultation_fee}` : 'Not set'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        
                                        <ProfileForms user={user} doctorDetails={doctorDetails} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
