import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ServicesPage() {
  return (
    <div className="services-page">
      <Header />
      <main className="main">
      
          {/* Page Title */}
          <div className="page-title">
            <div className="heading">
              <div className="container">
                <div className="row d-flex justify-content-center text-center">
                  <div className="col-lg-8">
                    <h1 className="heading-title">Services</h1>
                    <p className="mb-0">
                      Odio et unde deleniti. Deserunt numquam exercitationem. Officiis quo
                      odio sint voluptas consequatur ut a odio voluptatem. Sit dolorum
                      debitis veritatis natus dolores. Quasi ratione sint. Sit quaerat
                      ipsum dolorem.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <nav className="breadcrumbs">
              <div className="container">
                <ol>
                  <li><a href="/">Home</a></li>
                  <li className="current">Services</li>
                </ol>
              </div>
            </nav>
          </div>{/* End Page Title */}
      
          {/* Services Section */}
          <section id="services" className="services section">
      
            <div className="container" data-aos="fade-up" data-aos-delay="100">
      
              <div className="row gy-4">
      
                <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="200">
                  <div className="service-item">
                    <div className="service-image">
                      <img src="assets/img/health/cardiology-2.webp" alt="Cardiology Services" className="img-fluid" />
                      <div className="service-overlay">
                        <i className="fas fa-heartbeat"></i>
                      </div>
                    </div>
                    <div className="service-content">
                      <h3>Cardiology</h3>
                      <p>Comprehensive heart care with advanced diagnostic tools and treatment options for cardiovascular
                        conditions.</p>
                      <div className="service-features">
                        <span className="feature-item"><i className="fas fa-check"></i> ECG Testing</span>
                        <span className="feature-item"><i className="fas fa-check"></i> Heart Surgery</span>
                      </div>
                      <a href="/service-details" className="service-btn">
                        <span>Learn More</span>
                        <i className="fas fa-arrow-right"></i>
                      </a>
                    </div>
                  </div>
                </div>{/* End Service Item */}
      
                <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="250">
                  <div className="service-item">
                    <div className="service-image">
                      <img src="assets/img/health/neurology-3.webp" alt="Neurology Services" className="img-fluid" />
                      <div className="service-overlay">
                        <i className="fas fa-brain"></i>
                      </div>
                    </div>
                    <div className="service-content">
                      <h3>Neurology</h3>
                      <p>Expert neurological care for brain and nervous system disorders with state-of-the-art imaging
                        technology.</p>
                      <div className="service-features">
                        <span className="feature-item"><i className="fas fa-check"></i> MRI Scans</span>
                        <span className="feature-item"><i className="fas fa-check"></i> Stroke Care</span>
                      </div>
                      <a href="/service-details" className="service-btn">
                        <span>Learn More</span>
                        <i className="fas fa-arrow-right"></i>
                      </a>
                    </div>
                  </div>
                </div>{/* End Service Item */}
      
                <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="300">
                  <div className="service-item">
                    <div className="service-image">
                      <img src="assets/img/health/orthopedics-1.webp" alt="Orthopedics Services" className="img-fluid" />
                      <div className="service-overlay">
                        <i className="fas fa-bone"></i>
                      </div>
                    </div>
                    <div className="service-content">
                      <h3>Orthopedics</h3>
                      <p>Specialized bone and joint treatment including sports medicine and reconstructive surgery procedures.
                      </p>
                      <div className="service-features">
                        <span className="feature-item"><i className="fas fa-check"></i> Joint Replacement</span>
                        <span className="feature-item"><i className="fas fa-check"></i> Sports Medicine</span>
                      </div>
                      <a href="/service-details" className="service-btn">
                        <span>Learn More</span>
                        <i className="fas fa-arrow-right"></i>
                      </a>
                    </div>
                  </div>
                </div>{/* End Service Item */}
      
                <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="350">
                  <div className="service-item">
                    <div className="service-image">
                      <img src="assets/img/health/pediatrics-4.webp" alt="Pediatrics Services" className="img-fluid" />
                      <div className="service-overlay">
                        <i className="fas fa-child"></i>
                      </div>
                    </div>
                    <div className="service-content">
                      <h3>Pediatrics</h3>
                      <p>Dedicated healthcare for children from infancy through adolescence with specialized treatment
                        protocols.</p>
                      <div className="service-features">
                        <span className="feature-item"><i className="fas fa-check"></i> Well-Child Visits</span>
                        <span className="feature-item"><i className="fas fa-check"></i> Immunizations</span>
                      </div>
                      <a href="/service-details" className="service-btn">
                        <span>Learn More</span>
                        <i className="fas fa-arrow-right"></i>
                      </a>
                    </div>
                  </div>
                </div>{/* End Service Item */}
      
                <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="400">
                  <div className="service-item">
                    <div className="service-image">
                      <img src="assets/img/health/emergency-2.webp" alt="Emergency Services" className="img-fluid" />
                      <div className="service-overlay">
                        <i className="fas fa-ambulance"></i>
                      </div>
                    </div>
                    <div className="service-content">
                      <h3>Emergency Care</h3>
                      <p>24/7 emergency medical services with rapid response teams and critical care capabilities.</p>
                      <div className="service-features">
                        <span className="feature-item"><i className="fas fa-check"></i> Trauma Center</span>
                        <span className="feature-item"><i className="fas fa-check"></i> Critical Care</span>
                      </div>
                      <a href="/service-details" className="service-btn">
                        <span>Learn More</span>
                        <i className="fas fa-arrow-right"></i>
                      </a>
                    </div>
                  </div>
                </div>{/* End Service Item */}
      
                <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="450">
                  <div className="service-item">
                    <div className="service-image">
                      <img src="assets/img/health/laboratory-3.webp" alt="Laboratory Services" className="img-fluid" />
                      <div className="service-overlay">
                        <i className="fas fa-microscope"></i>
                      </div>
                    </div>
                    <div className="service-content">
                      <h3>Laboratory Testing</h3>
                      <p>Advanced diagnostic laboratory services with comprehensive testing panels and rapid result delivery.
                      </p>
                      <div className="service-features">
                        <span className="feature-item"><i className="fas fa-check"></i> Blood Tests</span>
                        <span className="feature-item"><i className="fas fa-check"></i> Pathology</span>
                      </div>
                      <a href="/service-details" className="service-btn">
                        <span>Learn More</span>
                        <i className="fas fa-arrow-right"></i>
                      </a>
                    </div>
                  </div>
                </div>{/* End Service Item */}
      
              </div>
      
            </div>
      
          </section>{/* /Services Section */}
      
        </main>
      <Footer />
    </div>
  );
}
