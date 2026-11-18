import React from 'react';

const HeroCarousel = () => {
  const images = [
    "/assets/banner/blur-hospital.jpg",
    "/assets/banner/doctor-with-stethoscope-hands-hospital-background.jpg",
    "/assets/banner/ordinary-busy-day-surgeon.jpg"
  ];
  const avatars = [
    "/assets/img/person/person-m-3.webp",
    "/assets/img/person/person-f-5.webp",
    "/assets/img/person/person-m-7.webp"
  ];

  const searchFields = (
    <>
      <input
        type="text"
        className="form-control flex-grow-1"
        placeholder="Search For Doctor/Department/Any Thing..."
      />
      <select className="form-select text-muted">
        <option>-- Select Option --</option>
        <option>Doctor</option>
        <option>Department</option>
        <option>Hospital</option>
      </select>
      <button className="btn text-white px-4" aria-label="Search">
        <i className="bi bi-search fs-5"></i>
      </button>
    </>
  );

  return (
    <>
    <div className="position-relative cl-hero">
      {/* Background carousel */}
      <div id="heroBannerCarousel" className="carousel slide carousel-fade cl-hero-bg" data-bs-ride="carousel" data-bs-interval="4000">
        <div className="carousel-inner h-100">
          {images.map((src, index) => (
            <div key={index} className={`carousel-item ${index === 0 ? 'active ' : ''}h-100`}>
              <div
                className="w-100 h-100"
                style={{
                  backgroundImage: `url('${src}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              ></div>
            </div>
          ))}
        </div>
        <div className="cl-hero-shade" aria-hidden="true"></div>
      </div>

      {/* Foreground content */}
      <div className="container cl-hero-content">
        {/* Search bar: top of the banner on laptops and up; smaller screens get it below the banner */}
        <div className="cl-hero-search cl-hero-search-top d-none d-lg-flex gap-2 cl-rise">
          {searchFields}
        </div>

        <div className="row cl-hero-main">
          <div className="col-lg-9 col-xl-8">
            <div className="cl-hero-rating cl-rise">
              <div className="cl-hero-avatars">
                {avatars.map((src) => <img key={src} src={src} alt="User Image" />)}
              </div>
              <div>
                <div className="cl-hero-rating-score">4.9/5 Rating</div>
                <div className="cl-hero-rating-sub">2k Client in the World</div>
              </div>
            </div>

            <h1 className="cl-hero-title cl-rise" style={{ animationDelay: '.08s' }}>
              Exceptional care<br />Better health
            </h1>
            <p className="cl-hero-lead cl-rise" style={{ animationDelay: '.16s' }}>
              Experience trusted healthcare delivered by skilled physicians, advanced diagnostic technology.
            </p>

            <div className="cl-rise" style={{ animationDelay: '.24s' }}>
              <a href="/appointment" className="cl-pill-btn cl-pill-btn-light cl-pill-btn-lg">
                <span>Book Appointment</span>
                <span className="cl-pill-btn-icon" aria-hidden="true"><i className="bi bi-arrow-up-right"></i><i className="bi bi-arrow-up-right"></i></span>
              </a>
            </div>
          </div>

        </div>


        {/* Carousel controls */}
        <div className="cl-hero-ctrls">
          <button className="cl-hero-ctrl" type="button" data-bs-target="#heroBannerCarousel" data-bs-slide="prev" aria-label="Previous">
            <i className="bi bi-chevron-left"></i>
          </button>
          <button className="cl-hero-ctrl" type="button" data-bs-target="#heroBannerCarousel" data-bs-slide="next" aria-label="Next">
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>

    {/* Smaller screens: search in its own strip right after the banner */}
    <div className="cl-search-strip d-lg-none">
      <div className="container">
        <div className="cl-hero-search d-flex flex-column flex-sm-row gap-2">
          {searchFields}
        </div>
      </div>
    </div>
    </>
  );
};

export default HeroCarousel;
