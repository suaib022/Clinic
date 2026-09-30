import React from 'react';

const HeroCarousel = () => {
  const images = [
    "/assets/banner/blur-hospital.jpg",
    "/assets/banner/doctor-with-stethoscope-hands-hospital-background.jpg",
    "/assets/banner/ordinary-busy-day-surgeon.jpg"
  ];

  return (
    <div className="position-relative">
      {/* Carousel */}
      <div id="heroBannerCarousel" className="carousel slide carousel-fade" data-bs-ride="carousel" data-bs-interval="4000">
        <div className="carousel-inner" style={{ height: '450px' }}>
          {images.map((src, index) => (
            <div key={index} className={`carousel-item ${index === 0 ? 'active' : ''} h-100`}>
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
        
        {/* Controls */}
        <button className="carousel-control-prev" type="button" data-bs-target="#heroBannerCarousel" data-bs-slide="prev" style={{ width: '7%' }}>
          <span className="carousel-control-prev-icon rounded-circle bg-dark bg-opacity-25 p-3" aria-hidden="true" style={{ width: '50px', height: '50px' }}></span>
          <span className="visually-hidden">Previous</span>
        </button>
        <button className="carousel-control-next" type="button" data-bs-target="#heroBannerCarousel" data-bs-slide="next" style={{ width: '7%' }}>
          <span className="carousel-control-next-icon rounded-circle bg-dark bg-opacity-25 p-3" aria-hidden="true" style={{ width: '50px', height: '50px' }}></span>
          <span className="visually-hidden">Next</span>
        </button>
      </div>

      {/* Overlay Search Box */}
      <div className="position-absolute top-50 start-50 translate-middle w-100 px-3" style={{ zIndex: 10, maxWidth: '850px' }}>
        
        {/* Search Bar */}
        <div className="bg-white rounded shadow-lg d-flex flex-column flex-md-row overflow-hidden mb-3">
          <input 
            type="text" 
            className="form-control border-0 p-3 shadow-none flex-grow-1" 
            placeholder="Search For Doctor/Department/Any Thing..." 
            style={{ borderRadius: 0, fontSize: '15px' }}
          />
          <div className="border-start d-none d-md-block"></div>
          <select className="form-select border-0 p-3 shadow-none text-muted" style={{ borderRadius: 0, minWidth: '200px', fontSize: '15px' }}>
            <option>-- Select Option --</option>
            <option>Doctor</option>
            <option>Department</option>
            <option>Hospital</option>
          </select>
          <button className="btn text-white px-4 py-3 border-0" style={{ backgroundColor: '#ff7315', borderRadius: 0 }}>
            <i className="bi bi-search fs-5"></i>
          </button>
        </div>

        {/* Hospital / Diagnostic Bottom Panels */}
        <div className="bg-white bg-opacity-75 rounded shadow d-flex flex-column flex-md-row overflow-hidden" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="flex-fill text-center p-4 border-end border-light" style={{ cursor: 'pointer' }}>
            <div className="mb-2" style={{ color: '#0D7D72' }}>
              <i className="bi bi-hospital" style={{ fontSize: '2.5rem' }}></i>
            </div>
            <h5 className="fw-bold mb-0" style={{ color: '#043947' }}>Hospital</h5>
          </div>
          <div className="flex-fill text-center p-4" style={{ cursor: 'pointer' }}>
            <div className="mb-2" style={{ color: '#0D7D72' }}>
              <i className="bi bi-clipboard2-pulse" style={{ fontSize: '2.5rem' }}></i>
            </div>
            <h5 className="fw-bold mb-0" style={{ color: '#043947' }}>Diagnostic</h5>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HeroCarousel;
