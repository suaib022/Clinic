export default function Footer() {
  return (
    <footer id="footer" className="footer-16 footer position-relative">

      <div className="container">

        {/* CTA card */}
        <div className="cl-footer-cta" data-aos="fade-up" style={{ backgroundImage: "url('/assets/img/health/consultation-4.webp')" }}>
          <div className="cl-footer-cta-inner">
            <h2>Compassionate Care, Advanced Medicine</h2>
            <p>Experience trusted healthcare delivered by skilled physicians, advanced diagnostic technology.</p>
            <div className="cl-footer-cta-actions">
              <a href="/appointment" className="cl-pill-btn cl-pill-btn-light cl-pill-btn-lg">
                <span>Book Appointment</span>
                <span className="cl-pill-btn-icon" aria-hidden="true"><i className="bi bi-arrow-up-right"></i><i className="bi bi-arrow-up-right"></i></span>
              </a>
              <div className="cl-footer-cta-rating">
                <div>4.9/5 <span className="cl-stars" aria-hidden="true"><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i></span></div>
                <div className="cl-footer-cta-rating-sub">2k Client in the World</div>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-main" data-aos="fade-up" data-aos-delay="100">
          <div className="row align-items-start">

            <div className="col-lg-5">
              <div className="brand-section">
                <a href="/" className="logo d-flex align-items-center mb-4">
                  <span className="sitename">Clinic</span>
                </a>
                <p className="brand-description">Crafting exceptional digital experiences through thoughtful design and
                  innovative solutions that elevate your brand presence.</p>

                <div className="contact-info mt-5">
                  <div className="contact-item">
                    <i className="bi bi-geo-alt"></i>
                    <span>123 Creative Boulevard, Design District, NY 10012</span>
                  </div>
                  <div className="contact-item">
                    <i className="bi bi-telephone"></i>
                    <span>+1 (555) 987-6543</span>
                  </div>
                  <div className="contact-item">
                    <i className="bi bi-envelope"></i>
                    <span>hello@designstudio.com</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="footer-nav-wrapper">
                <div className="row">

                  <div className="col-6 col-lg-3">
                    <div className="nav-column">
                      <h6>Studio</h6>
                      <nav className="footer-nav">
                        <a href="#!">Our Story</a>
                        <a href="#!">Design Process</a>
                        <a href="#!">Portfolio</a>
                        <a href="#!">Case Studies</a>
                        <a href="#!">Awards</a>
                      </nav>
                    </div>
                  </div>

                  <div className="col-6 col-lg-3">
                    <div className="nav-column">
                      <h6>Services</h6>
                      <nav className="footer-nav">
                        <a href="#!">Brand Identity</a>
                        <a href="#!">Web Design</a>
                        <a href="#!">Mobile Apps</a>
                        <a href="#!">Digital Strategy</a>
                        <a href="#!">Consultation</a>
                      </nav>
                    </div>
                  </div>

                  <div className="col-6 col-lg-3">
                    <div className="nav-column">
                      <h6>Resources</h6>
                      <nav className="footer-nav">
                        <a href="#!">Design Blog</a>
                        <a href="#!">Style Guide</a>
                        <a href="#!">Free Assets</a>
                        <a href="#!">Tutorials</a>
                        <a href="#!">Inspiration</a>
                      </nav>
                    </div>
                  </div>

                  <div className="col-6 col-lg-3">
                    <div className="nav-column">
                      <h6>Connect</h6>
                      <nav className="footer-nav">
                        <a href="#!">Start Project</a>
                        <a href="#!">Schedule Call</a>
                        <a href="#!">Join Newsletter</a>
                        <a href="#!">Follow Updates</a>
                        <a href="#!">Partnership</a>
                      </nav>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      <div className="footer-bottom">
        <div className="container">
          <div className="bottom-content" data-aos="fade-up" data-aos-delay="300">
            <div className="row align-items-center">

              <div className="col-lg-6">
                <div className="copyright">
                  <p>© <span className="sitename">Clinic</span>. All rights reserved.</p>
                </div>
              </div>

              <div className="col-lg-6">
                <div className="legal-links">
                  <a href="#!">Privacy Policy</a>
                  <a href="#!">Terms of Service</a>
                  <a href="#!">Cookie Policy</a>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

    </footer>
  );
}
