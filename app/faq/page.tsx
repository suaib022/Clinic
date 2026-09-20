import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function FaqPage() {
  return (
    <div className="faq-page">
      <Header />
      <main className="main">
      
          {/* Page Title */}
          <div className="page-title">
            <div className="heading">
              <div className="container">
                <div className="row d-flex justify-content-center text-center">
                  <div className="col-lg-8">
                    <h1 className="heading-title">Frequenty Asked Questions</h1>
                    <p className="mb-0">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec
                      ullamcorper mattis, pulvinar dapibus leo.</p>
                  </div>
                </div>
              </div>
            </div>
            <nav className="breadcrumbs">
              <div className="container">
                <ol>
                  <li><a href="/">Home</a></li>
                  <li className="current">Faq</li>
                </ol>
              </div>
            </nav>
          </div>{/* End Page Title */}
      
          {/* Faq Section */}
          <section id="faq" className="faq section">
      
            <div className="container" data-aos="fade-up" data-aos-delay="100">
      
              <div className="row justify-content-center">
                <div className="col-lg-9">
      
                  <div className="faq-wrapper">
      
                    <div className="faq-item faq-active" data-aos="fade-up" data-aos-delay="150">
                      <div className="faq-header">
                        <span className="faq-number">01</span>
                        <h4>Donec sollicitudin molestie malesuada proin eget tortor?</h4>
                        <div className="faq-toggle">
                          <i className="bi bi-plus"></i>
                          <i className="bi bi-dash"></i>
                        </div>
                      </div>
                      <div className="faq-content">
                        <div className="content-inner">
                          <p>Curabitur arcu erat, accumsan id imperdiet et, porttitor at sem. Donec rutrum congue leo eget
                            malesuada. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.
                          </p>
                        </div>
                      </div>
                    </div>{/* End FAQ Item */}
      
                    <div className="faq-item" data-aos="fade-up" data-aos-delay="200">
                      <div className="faq-header">
                        <span className="faq-number">02</span>
                        <h4>Sed porttitor lectus nibh vivamus magna justo?</h4>
                        <div className="faq-toggle">
                          <i className="bi bi-plus"></i>
                          <i className="bi bi-dash"></i>
                        </div>
                      </div>
                      <div className="faq-content">
                        <div className="content-inner">
                          <p>Nulla porttitor accumsan tincidunt. Mauris blandit aliquet elit, eget tincidunt nibh pulvinar a.
                            Cras ultricies ligula sed magna dictum porta. Vivamus suscipit tortor eget felis porttitor
                            volutpat.</p>
                        </div>
                      </div>
                    </div>{/* End FAQ Item */}
      
                    <div className="faq-item" data-aos="fade-up" data-aos-delay="250">
                      <div className="faq-header">
                        <span className="faq-number">03</span>
                        <h4>Pellentesque habitant morbi tristique senectus?</h4>
                        <div className="faq-toggle">
                          <i className="bi bi-plus"></i>
                          <i className="bi bi-dash"></i>
                        </div>
                      </div>
                      <div className="faq-content">
                        <div className="content-inner">
                          <p>Quisque velit nisi, pretium ut lacinia in, elementum id enim. Vestibulum ac diam sit amet quam
                            vehicula elementum sed sit amet dui. Donec sollicitudin molestie malesuada.</p>
                        </div>
                      </div>
                    </div>{/* End FAQ Item */}
      
                    <div className="faq-item" data-aos="fade-up" data-aos-delay="300">
                      <div className="faq-header">
                        <span className="faq-number">04</span>
                        <h4>Lorem ipsum dolor sit amet consectetur adipiscing?</h4>
                        <div className="faq-toggle">
                          <i className="bi bi-plus"></i>
                          <i className="bi bi-dash"></i>
                        </div>
                      </div>
                      <div className="faq-content">
                        <div className="content-inner">
                          <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.
                            Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto.</p>
                        </div>
                      </div>
                    </div>{/* End FAQ Item */}
      
                    <div className="faq-item" data-aos="fade-up" data-aos-delay="350">
                      <div className="faq-header">
                        <span className="faq-number">05</span>
                        <h4>Curabitur aliquet quam id dui posuere blandit?</h4>
                        <div className="faq-toggle">
                          <i className="bi bi-plus"></i>
                          <i className="bi bi-dash"></i>
                        </div>
                      </div>
                      <div className="faq-content">
                        <div className="content-inner">
                          <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum
                            deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati.</p>
                        </div>
                      </div>
                    </div>{/* End FAQ Item */}
      
                  </div>
      
                </div>
              </div>
      
            </div>
      
          </section>{/* /Faq Section */}
      
        </main>
      <Footer />
    </div>
  );
}
