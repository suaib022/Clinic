import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function NotfoundPage() {
  return (
    <div className="page-404">
      <Header />
      <main className="main">
      
          {/* Page Title */}
          <div className="page-title">
            <div className="heading">
              <div className="container">
                <div className="row d-flex justify-content-center text-center">
                  <div className="col-lg-8">
                    <h1 className="heading-title">404</h1>
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
                  <li className="current">404</li>
                </ol>
              </div>
            </nav>
          </div>{/* End Page Title */}
      
          {/* Error 404 Section */}
          <section id="error-404" className="error-404 section">
      
            <div className="container" data-aos="fade-up" data-aos-delay="100">
      
              <div className="row justify-content-center">
                <div className="col-lg-8 text-center">
      
                  <div className="error-number" data-aos="zoom-in" data-aos-delay="200">
                    404
                  </div>
      
                  <h1 className="error-title" data-aos="fade-up" data-aos-delay="300">
                    Page Not Found
                  </h1>
      
                  <p className="error-description" data-aos="fade-up" data-aos-delay="400">
                    The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.
                  </p>
      
                  <div className="error-actions" data-aos="fade-up" data-aos-delay="500">
                    <a href="/" className="btn-primary">
                      <i className="bi bi-house"></i>
                      Back to Home
                    </a>
                    <a href="#!" className="btn-secondary">
                      <i className="bi bi-search"></i>
                      Search Site
                    </a>
                  </div>
      
                </div>
              </div>
      
              <div className="row justify-content-center mt-5">
                <div className="col-lg-10">
      
                  <div className="helpful-links" data-aos="fade-up" data-aos-delay="600">
                    <h3>You might be looking for:</h3>
                    <div className="links-grid">
                      <a href="#!" className="link-item">
                        <i className="bi bi-info-circle"></i>
                        <span>About Us</span>
                      </a>
                      <a href="#!" className="link-item">
                        <i className="bi bi-telephone"></i>
                        <span>Contact</span>
                      </a>
                      <a href="#!" className="link-item">
                        <i className="bi bi-grid-3x3-gap"></i>
                        <span>Services</span>
                      </a>
                      <a href="#!" className="link-item">
                        <i className="bi bi-journal-text"></i>
                        <span>Blog</span>
                      </a>
                      <a href="#!" className="link-item">
                        <i className="bi bi-question-circle"></i>
                        <span>Support</span>
                      </a>
                      <a href="#!" className="link-item">
                        <i className="bi bi-shield-check"></i>
                        <span>Privacy Policy</span>
                      </a>
                    </div>
                  </div>
      
                </div>
              </div>
      
            </div>
      
          </section>{/* /Error 404 Section */}
      
        </main>
      <Footer />
    </div>
  );
}
