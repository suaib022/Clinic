import Link from 'next/link';
import React from 'react';

const QuickLinksBar = () => {
  const links = [
    {
      title: "Book Appointment",
      icon: "bi bi-hospital",
      href: "/appointment"
    },
    {
      title: "Find A Doctor",
      icon: "bi bi-person-badge",
      href: "/doctors"
    },
    {
      title: "Online Report",
      icon: "bi bi-clipboard-plus",
      href: "#"
    },
    {
      title: "Packages and Vaccines",
      icon: "bi bi-calendar2-range",
      href: "#"
    }
  ];

  return (
    <div className="py-4 py-lg-5" style={{ backgroundColor: '#f8f9fa', marginTop: '100px' }}>
      <div className="container">
        <div className="row justify-content-center align-items-center">
          {links.map((link, index) => (
            <div key={index} className="col-12 col-sm-6 col-md-3 mb-3 mb-md-0">
              <Link 
                href={link.href} 
                className="text-decoration-none d-flex align-items-center justify-content-center justify-content-md-start mx-auto" 
                style={{ color: '#2b5a5e', maxWidth: 'max-content' }}
              >
                <div 
                  className="bg-white d-flex align-items-center justify-content-center me-3" 
                  style={{ width: '56px', height: '56px', color: '#439794', boxShadow: 'none' }}
                >
                  <i className={`${link.icon} fs-4`}></i>
                </div>
                <span className="fw-semibold text-start" style={{ fontSize: '15px', lineHeight: '1.2', maxWidth: '100px' }}>
                  {link.title}
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickLinksBar;
