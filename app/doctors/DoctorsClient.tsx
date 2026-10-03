"use client";

import { useState, useMemo } from "react";

export type Doctor = {
  id: number;
  name: string;
  designation: string;
  hospital: string;
  image_url: string;
  profile_url: string;
  social_links: {
    facebook: string | null;
    twitter: string | null;
    youtube: string | null;
    linkedin: string | null;
  } | null;
  speciality?: string;
  departments?: { name: string } | null;
};

const DEPARTMENTS = [
  { name: "All Departments", keywords: [] },
  { name: "Accident And Emergency", keywords: ["accident", "emergency"] },
  { name: "Anaesthesiology", keywords: ["anaesthesiology", "anesthesiologist", "anesthesia", "icu"] },
  { name: "Burn & Plastic Surgery", keywords: ["burn", "plastic surgery"] },
  { name: "Cardiac Surgery", keywords: ["cardiac", "cardiologist", "cardiology"] },
  { name: "Colorectal Surgery", keywords: ["colorectal"] },
  { name: "Dental", keywords: ["dental", "dentist", "teeth", "maxillofacial", "oral"] },
  { name: "Dermatology", keywords: ["dermatology", "dermatologist", "skin"] },
  { name: "Endocrinology", keywords: ["endocrinology", "endocrinologist", "diabetology", "diabetes"] },
  { name: "ENT", keywords: ["ent", "ear", "nose", "throat", "otorhinolaryngology"] },
  { name: "Gastroenterology", keywords: ["gastroenterology", "gastroenterologist", "liver", "pancreas"] },
  { name: "General Surgery", keywords: ["general surgeon", "surgery", "laparoscopic"] },
  { name: "Gynecology & Obstetrics", keywords: ["gynecology", "gynaecology", "obstetrics", "infertility", "maternal", "women"] },
  { name: "Medicine", keywords: ["medicine", "internal"] },
  { name: "Neurology", keywords: ["neurology", "neurologist", "neuro"] },
  { name: "Oncology", keywords: ["oncology", "oncologist", "cancer"] },
  { name: "Orthopedics", keywords: ["orthopedic", "orthopaedics"] },
  { name: "Pediatrics", keywords: ["pediatric", "pediatrics", "child", "children", "neonatal"] },
  { name: "Psychiatry", keywords: ["psychiatry", "psychiatrist", "mental"] },
  { name: "Urology", keywords: ["urology", "urologist", "kidney"] }
];

export default function DoctorsClient({ 
  initialDoctors, 
  initialDept = "All Departments",
  dynamicDepartments = []
}: { 
  initialDoctors: Doctor[], 
  initialDept?: string,
  dynamicDepartments?: { name: string, overview?: string, keywords: string[] }[]
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeDepartment, setActiveDepartment] = useState(initialDept);
  
  const allDepartments = useMemo(() => {
    if (!dynamicDepartments || dynamicDepartments.length === 0) return DEPARTMENTS;
    const merged = [{ name: "All Departments", overview: "", keywords: [] as string[] }];
    const deptMap = new Map(DEPARTMENTS.map(d => [d.name, d.keywords]));
    
    dynamicDepartments.forEach(d => {
      const keywords = deptMap.has(d.name) ? deptMap.get(d.name)! : [];
      merged.push({ name: d.name, overview: d.overview, keywords } as any);
    });
    return merged;
  }, [dynamicDepartments]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const filteredDoctors = useMemo(() => {
    return initialDoctors.filter((doc) => {
      // 1. Search filter
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (doc.designation && doc.designation.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // 2. Department filter
      let matchesDept = true;
      if (activeDepartment !== "All Departments") {
        if (doc.departments?.name) {
          matchesDept = doc.departments.name.toLowerCase() === activeDepartment.toLowerCase();
        } else {
          const deptConfig = allDepartments.find(d => d.name === activeDepartment);
          const designationLower = (doc.designation || "").toLowerCase();
          if (deptConfig && deptConfig.keywords.length > 0) {
            matchesDept = deptConfig.keywords.some(keyword => designationLower.includes(keyword));
          } else {
            // Fallback if department not in hardcoded list
            matchesDept = designationLower.includes(activeDepartment.toLowerCase());
          }
        }
      }

      return matchesSearch && matchesDept;
    });
  }, [initialDoctors, searchTerm, activeDepartment]);

  const totalPages = Math.ceil(filteredDoctors.length / itemsPerPage);
  const currentDoctors = filteredDoctors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <section id="doctors" className="doctors section bg-light" style={{ padding: "60px 0" }}>
      <div className="container" data-aos="fade-up" data-aos-delay="100">
        
        <div className="row">
          {/* Left Sidebar */}
          <div className="col-lg-3 mb-5 mb-lg-0">
            <div className="sidebar shadow-sm bg-white" style={{ borderRadius: "10px", overflowY: "auto", maxHeight: "calc(100vh - 120px)", position: "sticky", top: "100px" }}>
              <ul className="list-unstyled mb-0">
                {allDepartments.map((dept, index) => {
                  const isActive = activeDepartment === dept.name;
                  return (
                    <li 
                      key={index} 
                      className={`d-flex justify-content-between align-items-center p-3 border-bottom`}
                      style={{ 
                        cursor: "pointer", 
                        transition: "all 0.2s ease",
                        backgroundColor: isActive ? "#f8f9fa" : "#fff",
                        color: isActive ? "#1977cc" : "#333",
                        fontWeight: isActive ? "600" : "500",
                        borderLeft: isActive ? "4px solid #1977cc" : "4px solid transparent"
                      }}
                      onClick={() => {
                        setActiveDepartment(dept.name);
                        setCurrentPage(1);
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                          e.currentTarget.style.color = '#1977cc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = '#fff';
                          e.currentTarget.style.color = '#333';
                        }
                      }}
                    >
                      <span>{dept.name}</span>
                      <i className="bi bi-chevron-right" style={{ fontSize: "0.85rem", opacity: isActive ? 1 : 0.4 }}></i>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-lg-9">
            {/* Search Box */}
            <div className="row mb-4">
              <div className="col-12">
                <div className="search-box position-relative">
                  <input 
                    type="text" 
                    className="form-control form-control-lg rounded-pill px-4" 
                    placeholder="Search by doctor name or designation..." 
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{ boxShadow: "0 2px 15px rgba(0,0,0,0.05)", border: "1px solid #e9ecef" }}
                  />
                  <i className="bi bi-search position-absolute" style={{ right: "20px", top: "50%", transform: "translateY(-50%)", color: "#6c757d" }}></i>
                </div>
              </div>
            </div>

            {/* Department Article Block */}
            {activeDepartment !== "All Departments" && (() => {
              const activeDepartmentConfig = allDepartments.find(d => d.name === activeDepartment) as any;
              const hasOverview = activeDepartmentConfig && activeDepartmentConfig.overview && (activeDepartmentConfig.overview as string).trim() !== '';
              
              return (
                <>
                  <div className="card border-0 shadow-sm rounded-0 mb-4 bg-white" data-aos="fade-up">
                    <div className="card-body p-4">
                      <h3 className="fw-bold" style={{ color: '#0D7D72' }}>{activeDepartment} Department</h3>
                      {hasOverview && (
                        <p className="text-muted mb-0 mt-3" style={{ lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                          {activeDepartmentConfig.overview}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Doctors Grid */}
                  {currentDoctors.length > 0 && (
                    <div className="row gy-4">
                      {currentDoctors.map((doc, idx) => (
                        <div key={doc.id} className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay={100 + (idx % 3) * 100}>
                          <div className="doctor-card h-100 d-flex flex-column bg-white" style={{ transition: "transform 0.3s ease", borderRadius: "15px", overflow: "hidden", boxShadow: "0 5px 25px rgba(0,0,0,0.05)" }}>
                            <div className="doctor-image position-relative" style={{ backgroundColor: "transparent", padding: 0, borderRadius: 0, width: "100%", height: "auto" }}>
                              <img 
                                src={doc.image_url || "assets/img/health/default-doctor.webp"} 
                                alt={doc.name} 
                                className="img-fluid w-100" 
                                style={{ objectFit: 'contain', height: '260px', objectPosition: 'top', borderRadius: 0 }} 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "assets/img/health/default-doctor.webp";
                                  (e.target as HTMLImageElement).onerror = null;
                                }}
                              />
                              <div className="doctor-overlay" style={{ borderRadius: 0 }}>
                                <div className="social-links">
                                  {doc.social_links?.linkedin && <a href={doc.social_links.linkedin} target="_blank" rel="noreferrer"><i className="bi bi-linkedin"></i></a>}
                                  {doc.social_links?.facebook && <a href={doc.social_links.facebook} target="_blank" rel="noreferrer"><i className="bi bi-facebook"></i></a>}
                                  {doc.social_links?.twitter && <a href={doc.social_links.twitter} target="_blank" rel="noreferrer"><i className="bi bi-twitter"></i></a>}
                                  {doc.social_links?.youtube && <a href={doc.social_links.youtube} target="_blank" rel="noreferrer"><i className="bi bi-youtube"></i></a>}
                                  {!doc.social_links?.linkedin && !doc.social_links?.facebook && !doc.social_links?.twitter && !doc.social_links?.youtube && (
                                    <a href={`/doctors/${doc.id}`}><i className="bi bi-link-45deg"></i></a>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="doctor-content flex-grow-1 d-flex flex-column p-4">
                              <h4 className="mb-2" style={{ fontSize: "1.1rem", fontWeight: "600", color: "#2c4964" }}>{doc.name}</h4>
                              <span className="specialty text-muted mb-3" style={{ fontSize: "0.85rem", minHeight: "40px", display: "block" }}>{doc.designation}</span>
                              <div className="doctor-meta mt-auto pt-3 border-top">
                                <div className="department d-flex align-items-center mb-3 text-secondary" style={{ fontSize: "0.85rem" }}>
                                  <i className="bi bi-building me-2 text-primary"></i>
                                  <span>{doc.hospital}</span>
                                </div>
                              </div>
                              <a href={`/doctors/${doc.id}`} className="btn-appointment w-100 text-center rounded-pill py-2" style={{ backgroundColor: "#1977cc", color: "#fff", transition: "0.3s", fontSize: "0.9rem" }}>View Profile</a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}


                </>
              );
            })()}

            {activeDepartment === "All Departments" && currentDoctors.length > 0 && (
              <div className="row gy-4">
                {currentDoctors.map((doc, idx) => (
                  <div key={doc.id} className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay={100 + (idx % 3) * 100}>
                    <div className="doctor-card h-100 d-flex flex-column bg-white" style={{ transition: "transform 0.3s ease", borderRadius: "15px", overflow: "hidden", boxShadow: "0 5px 25px rgba(0,0,0,0.05)" }}>
                      <div className="doctor-image position-relative" style={{ backgroundColor: "transparent", padding: 0, borderRadius: 0, width: "100%", height: "auto" }}>
                        <img 
                          src={doc.image_url || "assets/img/health/default-doctor.webp"} 
                          alt={doc.name} 
                          className="img-fluid w-100" 
                          style={{ objectFit: 'contain', height: '260px', objectPosition: 'top', borderRadius: 0 }} 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "assets/img/health/default-doctor.webp";
                            (e.target as HTMLImageElement).onerror = null;
                          }}
                        />
                        <div className="doctor-overlay" style={{ borderRadius: 0 }}>
                          <div className="social-links">
                            {doc.social_links?.linkedin && <a href={doc.social_links.linkedin} target="_blank" rel="noreferrer"><i className="bi bi-linkedin"></i></a>}
                            {doc.social_links?.facebook && <a href={doc.social_links.facebook} target="_blank" rel="noreferrer"><i className="bi bi-facebook"></i></a>}
                            {doc.social_links?.twitter && <a href={doc.social_links.twitter} target="_blank" rel="noreferrer"><i className="bi bi-twitter"></i></a>}
                            {doc.social_links?.youtube && <a href={doc.social_links.youtube} target="_blank" rel="noreferrer"><i className="bi bi-youtube"></i></a>}
                            {!doc.social_links?.linkedin && !doc.social_links?.facebook && !doc.social_links?.twitter && !doc.social_links?.youtube && (
                              <a href={`/doctors/${doc.id}`}><i className="bi bi-link-45deg"></i></a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="doctor-content flex-grow-1 d-flex flex-column p-4">
                        <h4 className="mb-2" style={{ fontSize: "1.1rem", fontWeight: "600", color: "#2c4964" }}>{doc.name}</h4>
                        <span className="specialty text-muted mb-3" style={{ fontSize: "0.85rem", minHeight: "40px", display: "block" }}>{doc.designation}</span>
                        <div className="doctor-meta mt-auto pt-3 border-top">
                          <div className="department d-flex align-items-center mb-3 text-secondary" style={{ fontSize: "0.85rem" }}>
                            <i className="bi bi-building me-2 text-primary"></i>
                            <span>{doc.hospital}</span>
                          </div>
                        </div>
                        <a href={`/doctors/${doc.id}`} className="btn-appointment w-100 text-center rounded-pill py-2" style={{ backgroundColor: "#1977cc", color: "#fff", transition: "0.3s", fontSize: "0.9rem" }}>View Profile</a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeDepartment === "All Departments" && currentDoctors.length === 0 && (
              <div className="row gy-4">
                <div className="col-12 text-center py-5 bg-white rounded-0 shadow-sm border border-secondary-subtle">
                  <i className="bi bi-search display-1 text-muted mb-3 d-block"></i>
                  <h4 className="text-secondary">No doctors found</h4>
                  <p className="text-muted">Try searching with a different term.</p>
                  <button 
                    className="btn btn-outline-primary mt-3 rounded-pill px-4"
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="row mt-5">
                <div className="col-12 d-flex justify-content-center">
                  <nav aria-label="Page navigation">
                    <ul className="pagination pagination-lg">
                      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                        <button className="page-link shadow-sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>Previous</button>
                      </li>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                          <button className={`page-link shadow-sm ${currentPage === page ? 'bg-primary text-white border-primary' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                        </li>
                      ))}

                      <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                        <button className="page-link shadow-sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>Next</button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </section>
  );
}
