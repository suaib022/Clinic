import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function GalleryPage() {
  return (
    <div className="gallery-page">
      <Header />
      <main className="main">
      
          {/* Page Title */}
          <div className="page-title">
            <div className="heading">
              <div className="container">
                <div className="row d-flex justify-content-center text-center">
                  <div className="col-lg-8">
                    <h1 className="heading-title">Gallery</h1>
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
                  <li className="current">Gallery</li>
                </ol>
              </div>
            </nav>
          </div>{/* End Page Title */}
      
          {/* Gallery Section */}
          <section id="gallery" className="gallery section">
      
            <div className="container-fluid" data-aos="fade-up" data-aos-delay="100">
      
              <div className="row gy-4 justify-content-center">
      
                <div className="col-xl-3 col-lg-4 col-md-6">
                  <div className="gallery-item h-100">
                    <img src="assets/img/gallery/gallery-1.webp" className="img-fluid" alt="" />
                    <div className="gallery-links d-flex align-items-center justify-content-center">
                      <a href="assets/img/gallery/gallery-1.webp" title="Gallery 1" className="glightbox preview-link"><i
                          className="bi bi-arrows-angle-expand"></i></a>
                      <a href="/gallery-single" className="details-link"><i className="bi bi-link-45deg"></i></a>
                    </div>
                  </div>
                </div>{/* End Gallery Item */}
      
                <div className="col-xl-3 col-lg-4 col-md-6">
                  <div className="gallery-item h-100">
                    <img src="assets/img/gallery/gallery-2.webp" className="img-fluid" alt="" />
                    <div className="gallery-links d-flex align-items-center justify-content-center">
                      <a href="assets/img/gallery/gallery-2.webp" title="Gallery 2" className="glightbox preview-link"><i
                          className="bi bi-arrows-angle-expand"></i></a>
                      <a href="/gallery-single" className="details-link"><i className="bi bi-link-45deg"></i></a>
                    </div>
                  </div>
                </div>{/* End Gallery Item */}
      
                <div className="col-xl-3 col-lg-4 col-md-6">
                  <div className="gallery-item h-100">
                    <img src="assets/img/gallery/gallery-3.webp" className="img-fluid" alt="" />
                    <div className="gallery-links d-flex align-items-center justify-content-center">
                      <a href="assets/img/gallery/gallery-3.webp" title="Gallery 3" className="glightbox preview-link"><i
                          className="bi bi-arrows-angle-expand"></i></a>
                      <a href="/gallery-single" className="details-link"><i className="bi bi-link-45deg"></i></a>
                    </div>
                  </div>
                </div>{/* End Gallery Item */}
      
                <div className="col-xl-3 col-lg-4 col-md-6">
                  <div className="gallery-item h-100">
                    <img src="assets/img/gallery/gallery-4.webp" className="img-fluid" alt="" />
                    <div className="gallery-links d-flex align-items-center justify-content-center">
                      <a href="assets/img/gallery/gallery-4.webp" title="Gallery 4" className="glightbox preview-link"><i
                          className="bi bi-arrows-angle-expand"></i></a>
                      <a href="/gallery-single" className="details-link"><i className="bi bi-link-45deg"></i></a>
                    </div>
                  </div>
                </div>{/* End Gallery Item */}
      
                <div className="col-xl-3 col-lg-4 col-md-6">
                  <div className="gallery-item h-100">
                    <img src="assets/img/gallery/gallery-5.webp" className="img-fluid" alt="" />
                    <div className="gallery-links d-flex align-items-center justify-content-center">
                      <a href="assets/img/gallery/gallery-5.webp" title="Gallery 5" className="glightbox preview-link"><i
                          className="bi bi-arrows-angle-expand"></i></a>
                      <a href="/gallery-single" className="details-link"><i className="bi bi-link-45deg"></i></a>
                    </div>
                  </div>
                </div>{/* End Gallery Item */}
      
                <div className="col-xl-3 col-lg-4 col-md-6">
                  <div className="gallery-item h-100">
                    <img src="assets/img/gallery/gallery-6.webp" className="img-fluid" alt="" />
                    <div className="gallery-links d-flex align-items-center justify-content-center">
                      <a href="assets/img/gallery/gallery-6.webp" title="Gallery 6" className="glightbox preview-link"><i
                          className="bi bi-arrows-angle-expand"></i></a>
                      <a href="/gallery-single" className="details-link"><i className="bi bi-link-45deg"></i></a>
                    </div>
                  </div>
                </div>{/* End Gallery Item */}
      
                <div className="col-xl-3 col-lg-4 col-md-6">
                  <div className="gallery-item h-100">
                    <img src="assets/img/gallery/gallery-7.webp" className="img-fluid" alt="" />
                    <div className="gallery-links d-flex align-items-center justify-content-center">
                      <a href="assets/img/gallery/gallery-7.webp" title="Gallery 7" className="glightbox preview-link"><i
                          className="bi bi-arrows-angle-expand"></i></a>
                      <a href="/gallery-single" className="details-link"><i className="bi bi-link-45deg"></i></a>
                    </div>
                  </div>
                </div>{/* End Gallery Item */}
      
                <div className="col-xl-3 col-lg-4 col-md-6">
                  <div className="gallery-item h-100">
                    <img src="assets/img/gallery/gallery-8.webp" className="img-fluid" alt="" />
                    <div className="gallery-links d-flex align-items-center justify-content-center">
                      <a href="assets/img/gallery/gallery-8.webp" title="Gallery 8" className="glightbox preview-link"><i
                          className="bi bi-arrows-angle-expand"></i></a>
                      <a href="/gallery-single" className="details-link"><i className="bi bi-link-45deg"></i></a>
                    </div>
                  </div>
                </div>{/* End Gallery Item */}
      
              </div>
      
            </div>
      
          </section>{/* /Gallery Section */}
      
        </main>
      <Footer />
    </div>
  );
}
