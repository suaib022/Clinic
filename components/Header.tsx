import HeaderAuthLinks from '@/components/HeaderAuthLinks'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function Header() {
  const supabase = await createClient();
  const { data: specialities } = await supabase.from('specialities').select('*').order('name');

  return (
    <header id="header" className="header fixed-top">
      <style dangerouslySetInnerHTML={{
        __html: `
        .mega-dropdown {
            position: static !important;
        }
        .mega-dropdown .mega-menu {
            display: none;
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            width: 950px;
            max-width: 95vw;
            z-index: 999;
            background-color: #fff;
            padding: 30px 40px;
            border-radius: 8px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.12);
            border: 1px solid #eaeaea;
        }
        .mega-dropdown:hover .mega-menu {
            display: block;
        }
        .department-link {
            transition: all 0.2s ease;
            font-size: 13px !important;
            color: #777 !important;
            padding: 12px 10px;
            border-bottom: 1px solid #f0f0f0;
            display: block;
            white-space: normal !important;
            line-height: 1.4;
            word-wrap: break-word;
        }
        .department-link:hover {
            color: #1B2978 !important;
        }
    `}} />

      <div className="branding d-flex align-items-cente" style={{ backgroundColor: "var(--background-color, #ffffff)" }}>

        <div className="container position-relative d-flex align-items-center justify-content-center gap-5">
          <a href="/" className="logo d-flex align-items-center">
            {/* Uncomment the line below if you also wish to use an image logo */}
            {/* <img src="assets/img/logo.webp" alt="" /> */}
            <h1 className="sitename">Clinic</h1>
          </a>

          <nav id="navmenu" className="navmenu">
            <ul>
              <li><a href="/" className="active">Home</a></li>
              <li><a href="/about">About</a></li>
              <li className="dropdown mega-dropdown">
                <a href="/departments"><span>Departments</span> <i className="bi bi-chevron-down toggle-dropdown"></i></a>
                <div className="mega-menu">
                  <div className="row gx-4 gy-2">
                    {specialities && specialities.map((dept: any) => (
                      <div className="col-md-3 col-6" key={dept.id} suppressHydrationWarning>
                        <Link href={`/doctors?dept=${encodeURIComponent(dept.name)}`} className="text-decoration-none text-secondary small d-block py-2 department-link">
                          {dept.name}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
              <li><a href="/services">Services</a></li>
              <li><a href="/doctors">Doctors</a></li>
              <li className="dropdown"><a href="#"><span>More Pages</span> <i className="bi bi-chevron-down toggle-dropdown"></i></a>
                <ul>
                  <li><a href="/department-details">Department Details</a></li>
                  <li><a href="/service-details">Service Details</a></li>
                  <li><a href="/appointment">Appointment</a></li>
                  <li><a href="/testimonials">Testimonials</a></li>
                  <li><a href="/faq">Frequently Asked Questions</a></li>
                  <li><a href="/gallery">Gallery</a></li>
                  <li><a href="/terms">Terms</a></li>
                  <li><a href="/privacy">Privacy</a></li>
                  <li><a href="/404">404</a></li>
                </ul>
              </li>
              {/* <li className="dropdown"><a href="#"><span>Dropdown</span> <i className="bi bi-chevron-down toggle-dropdown"></i></a>
              <ul>
                <li><a href="#">Dropdown 1</a></li>
                <li className="dropdown"><a href="#"><span>Deep Dropdown</span> <i className="bi bi-chevron-down toggle-dropdown"></i></a>
                  <ul>
                    <li><a href="#">Deep Dropdown 1</a></li>
                    <li><a href="#">Deep Dropdown 2</a></li>
                    <li><a href="#">Deep Dropdown 3</a></li>
                    <li><a href="#">Deep Dropdown 4</a></li>
                    <li><a href="#">Deep Dropdown 5</a></li>
                  </ul>
                </li>
                <li><a href="#">Dropdown 2</a></li>
                <li><a href="#">Dropdown 3</a></li>
                <li><a href="#">Dropdown 4</a></li>
              </ul>
            </li> */}
              <HeaderAuthLinks />
              <li className="cl-nav-cta d-xl-none">
                <a href="/doctors" className="cl-pill-btn cl-pill-btn-light">
                  <span>Find Doctors</span>
                  <span className="cl-pill-btn-icon" aria-hidden="true"><i className="bi bi-arrow-up-right"></i><i className="bi bi-arrow-up-right"></i></span>
                </a>
              </li>
            </ul>
            <i className="mobile-nav-toggle d-xl-none bi bi-list"></i>
          </nav>

          <a href="/doctors" className="cl-pill-btn cl-pill-btn-light cl-header-cta d-none d-xl-inline-flex">
            <span>Find Doctors</span>
            <span className="cl-pill-btn-icon" aria-hidden="true"><i className="bi bi-arrow-up-right"></i><i className="bi bi-arrow-up-right"></i></span>
          </a>

        </div>

      </div>

    </header>
  );
}
