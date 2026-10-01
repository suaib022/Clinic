import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from '@/lib/supabase/server';
import Link from "next/link";

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const { data: specialities } = await supabase.from('specialities').select('*').order('name');

  const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('cardio')) return 'bi-heart-pulse';
    if (n.includes('dent')) return 'bi-emoji-smile';
    if (n.includes('eye') || n.includes('ophthal')) return 'bi-eye';
    if (n.includes('ear') || n.includes('ent')) return 'bi-ear';
    if (n.includes('chest') || n.includes('pulmon')) return 'bi-lungs';
    if (n.includes('neuro') || n.includes('psych')) return 'bi-clipboard-pulse';
    if (n.includes('derma')) return 'bi-bandaid';
    if (n.includes('paed') || n.includes('pedi') || n.includes('child')) return 'bi-people';
    if (n.includes('ortho') || n.includes('bone') || n.includes('rheumat')) return 'bi-universal-access';
    if (n.includes('surgery') || n.includes('surgeon')) return 'bi-bandaid';
    if (n.includes('medicine') || n.includes('pharma')) return 'bi-capsule';
    if (n.includes('gastro') || n.includes('hepat') || n.includes('liver')) return 'bi-diagram-3';
    if (n.includes('gynae') || n.includes('obs')) return 'bi-gender-female';
    if (n.includes('onco') || n.includes('cancer')) return 'bi-activity';
    if (n.includes('endo') || n.includes('diabet')) return 'bi-droplet';
    if (n.includes('urol') || n.includes('nephro') || n.includes('kidney')) return 'bi-droplet-half';
    return 'bi-heart-pulse';
  };

  return (
    <div className="departments-page">
      <Header />
      <main className="main pt-5 mt-5">
      
          <div className="container mt-4 mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h1 className="fw-bold" style={{ color: '#0D7D72' }}>Our Departments</h1>
              <div>
                 <span className="text-muted small"><Link href="/" className="text-decoration-none text-muted">Home</Link> | Department</span>
              </div>
            </div>

            <div className="row mb-4">
               <div className="col-md-6">
                 <input type="text" className="form-control rounded-0" placeholder="Search For Department..." />
               </div>
               <div className="col-md-6 text-end">
                  <span className="text-muted small me-2">Sorted By Popularity</span>
                  <button className="btn text-white rounded-0" style={{ backgroundColor: '#fd7e14' }}>Sort</button>
               </div>
            </div>

            <div className="row g-4">
              {specialities && specialities.map((dept: any) => (
                <div className="col-lg-3 col-md-4 col-sm-6" key={dept.id}>
                  <Link href={`/doctors?dept=${encodeURIComponent(dept.name)}`} className="text-decoration-none">
                    <div className="card h-100 border-0 shadow-sm rounded-0 department-card" style={{ transition: 'transform 0.2s', cursor: 'pointer' }}>
                      <div className="card-body text-center p-4">
                        <div className="icon-box mb-3 d-flex justify-content-center align-items-center mx-auto" style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#f0f9f8', color: '#0ab1a9' }}>
                           <i className={`bi ${getIcon(dept.name)} fs-3`}></i>
                        </div>
                        <h6 className="card-title fw-bold" style={{ color: '#0D7D72' }}>{dept.name}</h6>
                        <p className="small text-muted mb-0 mt-3" style={{ fontSize: '13px' }}>
                          We provide specialized care and consultation for {dept.name.toLowerCase()} related issues.
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

          </div>
      </main>
      <Footer />
      <style dangerouslySetInnerHTML={{__html: `
         .department-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
         }
      `}} />
    </div>
  );
}
