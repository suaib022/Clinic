import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default async function DoctorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabase = await createClient();
  const { data: doctor, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !doctor) {
    notFound();
  }

  // Split designation by commas to show as separate items under "Speciality" if it's long
  const specialties = doctor.designation 
    ? doctor.designation.split(',').map((s: string) => s.trim()).filter(Boolean) 
    : [];

  return (
    <div className="doctor-detail-page bg-light">
      <Header />
      <main className="main">
        {/* Custom Banner Section */}
        <div 
          className="doctor-banner d-flex align-items-center" 
          style={{ 
            backgroundColor: "#155a65", 
            color: "#fff", 
            paddingTop: "140px", 
            paddingBottom: "60px" 
          }}
        >
          <div className="container">
            <div className="row">
              <div className="col-12">
                <h1 className="fw-bold mb-0 text-white" style={{ fontSize: "2.5rem" }}>{doctor.name}</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Doctor Details Section */}
        <section className="section py-5">
          <div className="container">
            <div className="bg-white p-4 p-md-5 shadow" style={{ borderTop: "3px solid #155a65", borderRadius: "4px" }}>
              <div className="row align-items-start">
                {/* Image Column */}
                <div className="col-lg-4 mb-5 mb-lg-0">
                  <div className="border p-2 text-center" style={{ backgroundColor: "#fff" }}>
                    <img 
                      src={doctor.image_url || "/assets/img/health/default-doctor.webp"} 
                      alt={doctor.name} 
                      className="img-fluid"
                      style={{ width: "100%", maxWidth: "100%", objectFit: "contain" }} 
                    />
                  </div>
                </div>
                
                {/* Details Column */}
                <div className="col-lg-8 ps-lg-5">
                  <div className="d-flex flex-wrap justify-content-between align-items-start mb-2">
                    <h3 className="mb-3 mb-md-0" style={{ fontWeight: 600, color: "#2c4964" }}>{doctor.name}</h3>
                    
                    {doctor.social_links && (
                      <div className="social-links d-flex">
                        {doctor.social_links.facebook && (
                          <a href={doctor.social_links.facebook} target="_blank" rel="noreferrer" className="ms-2 text-secondary border rounded-circle d-flex align-items-center justify-content-center hover-primary" style={{width:"38px", height:"38px", transition: "0.3s"}}>
                            <i className="bi bi-facebook"></i>
                          </a>
                        )}
                        {doctor.social_links.twitter && (
                          <a href={doctor.social_links.twitter} target="_blank" rel="noreferrer" className="ms-2 text-secondary border rounded-circle d-flex align-items-center justify-content-center hover-primary" style={{width:"38px", height:"38px", transition: "0.3s"}}>
                            <i className="bi bi-twitter"></i>
                          </a>
                        )}
                        {doctor.social_links.youtube && (
                          <a href={doctor.social_links.youtube} target="_blank" rel="noreferrer" className="ms-2 text-secondary border rounded-circle d-flex align-items-center justify-content-center hover-primary" style={{width:"38px", height:"38px", transition: "0.3s"}}>
                            <i className="bi bi-youtube"></i>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <h6 className="text-muted mb-4 fs-6" style={{ lineHeight: "1.6" }}>{doctor.designation}</h6>
                  
                  <h4 className="mt-5 mb-4" style={{ color: "#155a65", fontWeight: 500, fontSize: "1.5rem" }}>Speciality</h4>
                  
                  <ul className="list-unstyled mb-5">
                    {specialties.map((spec: string, index: number) => (
                      <li key={index} className="mb-2 fs-6 text-secondary" style={{ color: "#4f5a62" }}>
                        {spec}
                      </li>
                    ))}
                    {doctor.hospital && (
                      <li className="mb-2 fs-6 text-secondary" style={{ color: "#4f5a62" }}>
                        {doctor.hospital}
                      </li>
                    )}
                  </ul>
                  
                  <div className="mt-5 pt-3">
                    <a href="/appointment" className="btn btn-primary px-5 py-2" style={{ backgroundColor: "#155a65", border: "none", borderRadius: "4px" }}>
                      Book Appointment
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
