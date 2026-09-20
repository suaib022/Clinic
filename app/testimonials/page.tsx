import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function TestimonialsPage() {
  return (
    <div className="testimonials-page">
      <Header />
      <main className="main">
      
          {/* Page Title */}
          <div className="page-title">
            <div className="heading">
              <div className="container">
                <div className="row d-flex justify-content-center text-center">
                  <div className="col-lg-8">
                    <h1 className="heading-title">Testimonials</h1>
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
                  <li className="current">Testimonials</li>
                </ol>
              </div>
            </nav>
          </div>{/* End Page Title */}
      
          {/* Featured Testimonials Section */}
          <section id="featured-testimonials" className="featured-testimonials section">
      
            <div className="container" data-aos="fade-up" data-aos-delay="100">
      
              <div className="testimonials-14 swiper init-swiper">
                <script type="application/json" className="swiper-config" dangerouslySetInnerHTML={{ __html: `
                  {
                    "loop": true,
                    "speed": 600,
                    "autoplay": {
                      "delay": 5000
                    },
                    "slidesPerView": 3,
                    "spaceBetween": 24,
                    "pagination": {
                      "el": ".swiper-pagination",
                      "type": "bullets",
                      "clickable": true
                    },
                    "breakpoints": {
                      "320": {
                        "slidesPerView": 1,
                        "spaceBetween": 16
                      },
                      "768": {
                        "slidesPerView": 2,
                        "spaceBetween": 24
                      },
                      "1024": {
                        "slidesPerView": 3,
                        "spaceBetween": 24
                      }
                    }
                  }
                ` }} />
      
                <div className="swiper-wrapper">
      
                  {/* Testimonial Item 1 */}
                  <div className="swiper-slide">
                    <div className="testimonial-item">
                      <div className="stars">
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                      </div>
                      <p>Proin iaculis purus consequat sem cure digni ssim donec porttitora entum suscipit rhoncus.
                        Accusantium quam, ultricies eget id, aliquam eget nibh et. Maecen aliquam, risus at semper.</p>
                      <div className="profile">
                        <img src="assets/img/person/person-m-9.webp" className="testimonial-img" alt="" loading="lazy" />
                        <div className="info">
                          <h4>Marcus Chen <i className="bi bi-patch-check-fill"></i></h4>
                          <span>@marcuschen</span>
                        </div>
                      </div>
                    </div>
                  </div>{/* End testimonial item */}
      
                  {/* Testimonial Item 2 */}
                  <div className="swiper-slide">
                    <div className="testimonial-item">
                      <div className="stars">
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                      </div>
                      <p>Enim nisi quem export duis labore cillum quae magna enim sint quorum nulla quem veniam duis minim
                        tempor labore quem eram duis noster aute amet eram fore quis sint minim.</p>
                      <div className="profile">
                        <img src="assets/img/person/person-f-5.webp" className="testimonial-img" alt="" loading="lazy" />
                        <div className="info">
                          <h4>Sarah Mitchell <i className="bi bi-patch-check-fill"></i></h4>
                          <span>@sarahmitch</span>
                        </div>
                      </div>
                    </div>
                  </div>{/* End testimonial item */}
      
                  {/* Testimonial Item 3 */}
                  <div className="swiper-slide">
                    <div className="testimonial-item">
                      <div className="stars">
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                      </div>
                      <p>Fugiat enim eram quae cillum dolore dolor amet nulla culpa multos export minim fugiat minim velit
                        minim dolor enim duis veniam ipsum anim magna sunt elit fore quem dolore labore.</p>
                      <div className="profile">
                        <img src="assets/img/person/person-f-12.webp" className="testimonial-img" alt="" loading="lazy" />
                        <div className="info">
                          <h4>James Wilson <i className="bi bi-patch-check-fill"></i></h4>
                          <span>@jwilson</span>
                        </div>
                      </div>
                    </div>
                  </div>{/* End testimonial item */}
      
                  {/* Testimonial Item 4 */}
                  <div className="swiper-slide">
                    <div className="testimonial-item">
                      <div className="stars">
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                      </div>
                      <p>Quis quorum aliqua sint quem legam fore sunt eram irure aliqua veniam tempor noster veniam enim culpa
                        labore duis sunt culpa nulla illum cillum fugiat legam esse veniam culpa.</p>
                      <div className="profile">
                        <img src="assets/img/person/person-m-12.webp" className="testimonial-img" alt="" loading="lazy" />
                        <div className="info">
                          <h4>Emma Rodriguez <i className="bi bi-patch-check-fill"></i></h4>
                          <span>@emmarod</span>
                        </div>
                      </div>
                    </div>
                  </div>{/* End testimonial item */}
      
                  {/* Testimonial Item 5 */}
                  <div className="swiper-slide">
                    <div className="testimonial-item">
                      <div className="stars">
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                      </div>
                      <p>Export tempor illum tamen malis malis eram quae irure esse labore quem cillum quid cillum eram malis
                        quorum velit fore eram velit sunt aliqua noster fugiat irure amet legam anim culpa.</p>
                      <div className="profile">
                        <img src="assets/img/person/person-m-13.webp" className="testimonial-img" alt="" loading="lazy" />
                        <div className="info">
                          <h4>David Kumar <i className="bi bi-patch-check-fill"></i></h4>
                          <span>@davidkumar</span>
                        </div>
                      </div>
                    </div>
                  </div>{/* End testimonial item */}
      
                  {/* Testimonial Item 6 */}
                  <div className="swiper-slide">
                    <div className="testimonial-item">
                      <div className="stars">
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                        <i className="bi bi-star-fill"></i>
                      </div>
                      <p>Texit tempor illum tamen malis malis eram quae irure esse labore quem cillum quid cillum eram malis
                        quorum velit fore eram velit sunt aliqua noster fugiat irure amet legam anim culpa.</p>
                      <div className="profile">
                        <img src="assets/img/person/person-f-13.webp" className="testimonial-img" alt="" loading="lazy" />
                        <div className="info">
                          <h4>Sophia Lee <i className="bi bi-patch-check-fill"></i></h4>
                          <span>@sophialee</span>
                        </div>
                      </div>
                    </div>
                  </div>{/* End testimonial item */}
      
                </div>
      
                <div className="swiper-pagination"></div>
      
              </div>
      
            </div>
      
          </section>{/* /Featured Testimonials Section */}
      
          {/* Testimonials Section */}
          <section id="testimonials" className="testimonials section">
      
            <div className="container" data-aos="fade-up" data-aos-delay="100">
      
              <div className="row g-4">
                {/* Testimonial Item 1 */}
                <div className="col-lg-6" data-aos="fade-up" data-aos-delay="100">
                  <div className="testimonial-item">
                    <div className="stars">
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                    </div>
                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce posuere metus vitae arcu imperdiet, id
                      aliquet ante scelerisque. Sed sit amet sem vitae urna fringilla tempus.</p>
                    <div className="testimonial-footer">
                      <div className="testimonial-author">
                        <img src="assets/img/person/person-m-3.webp" alt="Author" className="img-fluid rounded-circle"
                          loading="lazy" />
                        <div>
                          <h5>Michael Anderson</h5>
                          <span>Software Developer</span>
                        </div>
                      </div>
                      <div className="quote-icon">
                        <i className="bi bi-quote"></i>
                      </div>
                    </div>
                  </div>
                </div>{/* End Testimonial Item */}
      
                {/* Testimonial Item 2 */}
                <div className="col-lg-6" data-aos="fade-up" data-aos-delay="200">
                  <div className="testimonial-item">
                    <div className="stars">
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                    </div>
                    <p>Cras fermentum odio eu feugiat lide par naso tierra. Justo eget nada terra videa magna derita valies
                      darta donna mare fermentum iaculis eu non diam phasellus.</p>
                    <div className="testimonial-footer">
                      <div className="testimonial-author">
                        <img src="assets/img/person/person-f-5.webp" alt="Author" className="img-fluid rounded-circle"
                          loading="lazy" />
                        <div>
                          <h5>Sophia Martinez</h5>
                          <span>Marketing Specialist</span>
                        </div>
                      </div>
                      <div className="quote-icon">
                        <i className="bi bi-quote"></i>
                      </div>
                    </div>
                  </div>
                </div>{/* End Testimonial Item */}
      
                {/* Testimonial Item 3 */}
                <div className="col-lg-6" data-aos="fade-up" data-aos-delay="300">
                  <div className="testimonial-item">
                    <div className="stars">
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                    </div>
                    <p>Quisque rutrum. Aenean imperdiet. Etiam ultricies nisi vel augue. Curabitur ullamcorper ultricies nisi.
                      Nam eget dui. Etiam rhoncus. Maecenas tempus, tellus eget condimentum.</p>
                    <div className="testimonial-footer">
                      <div className="testimonial-author">
                        <img src="assets/img/person/person-m-7.webp" alt="Author" className="img-fluid rounded-circle"
                          loading="lazy" />
                        <div>
                          <h5>David Wilson</h5>
                          <span>Graphic Designer</span>
                        </div>
                      </div>
                      <div className="quote-icon">
                        <i className="bi bi-quote"></i>
                      </div>
                    </div>
                  </div>
                </div>{/* End Testimonial Item */}
      
                {/* Testimonial Item 4 */}
                <div className="col-lg-6" data-aos="fade-up" data-aos-delay="400">
                  <div className="testimonial-item">
                    <div className="stars">
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                    </div>
                    <p>Vivamus elementum semper nisi. Aenean vulputate eleifend tellus. Aenean leo ligula, porttitor eu,
                      consequat vitae, eleifend ac, enim. Aliquam lorem ante, dapibus in, viverra quis.</p>
                    <div className="testimonial-footer">
                      <div className="testimonial-author">
                        <img src="assets/img/person/person-f-9.webp" alt="Author" className="img-fluid rounded-circle"
                          loading="lazy" />
                        <div>
                          <h5>Emily Johnson</h5>
                          <span>UX Designer</span>
                        </div>
                      </div>
                      <div className="quote-icon">
                        <i className="bi bi-quote"></i>
                      </div>
                    </div>
                  </div>
                </div>{/* End Testimonial Item */}
      
                {/* Testimonial Item 5 */}
                <div className="col-lg-6" data-aos="fade-up" data-aos-delay="500">
                  <div className="testimonial-item">
                    <div className="stars">
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                    </div>
                    <p>Praesent nonummy mi in odio. Nullam accumsan lorem in dui. Cras ultricies mi eu turpis hendrerit
                      fringilla. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices.</p>
                    <div className="testimonial-footer">
                      <div className="testimonial-author">
                        <img src="assets/img/person/person-f-11.webp" alt="Author" className="img-fluid rounded-circle"
                          loading="lazy" />
                        <div>
                          <h5>Olivia Thompson</h5>
                          <span>Entrepreneur</span>
                        </div>
                      </div>
                      <div className="quote-icon">
                        <i className="bi bi-quote"></i>
                      </div>
                    </div>
                  </div>
                </div>{/* End Testimonial Item */}
      
                {/* Testimonial Item 6 */}
                <div className="col-lg-6" data-aos="fade-up" data-aos-delay="600">
                  <div className="testimonial-item">
                    <div className="stars">
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                      <i className="bi bi-star-fill"></i>
                    </div>
                    <p>Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut,
                      imperdiet a, venenatis vitae, justo. Nullam dictum felis eu pede mollis pretium.</p>
                    <div className="testimonial-footer">
                      <div className="testimonial-author">
                        <img src="assets/img/person/person-m-12.webp" alt="Author" className="img-fluid rounded-circle"
                          loading="lazy" />
                        <div>
                          <h5>James Taylor</h5>
                          <span>Financial Analyst</span>
                        </div>
                      </div>
                      <div className="quote-icon">
                        <i className="bi bi-quote"></i>
                      </div>
                    </div>
                  </div>
                </div>{/* End Testimonial Item */}
      
              </div>
      
            </div>
      
          </section>{/* /Testimonials Section */}
      
        </main>
      <Footer />
    </div>
  );
}
