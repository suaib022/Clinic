import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function AppointmentPage() {
  return (
    <div className="appointment-page">
      <Header />
      <main className="main">
      
          {/* Page Title */}
          <div className="page-title">
            <div className="heading">
              <div className="container">
                <div className="row d-flex justify-content-center text-center">
                  <div className="col-lg-8">
                    <h1 className="heading-title">Appointment</h1>
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
                  <li className="current">Appointment</li>
                </ol>
              </div>
            </nav>
          </div>{/* End Page Title */}
      
          {/* Appointmnet Section */}
          <section id="appointmnet" className="appointmnet section">
      
            <div className="container" data-aos="fade-up" data-aos-delay="100">
      
              <div className="row">
                <div className="col-lg-8 mx-auto">
                  <div className="booking-wrapper">
                    <div className="booking-header text-center" data-aos="fade-up" data-aos-delay="200">
                      <h2>Schedule Your Appointment</h2>
                      <p>Book your medical appointment in just a few simple steps. Our experienced healthcare professionals
                        are ready to provide you with the best care possible.</p>
                    </div>
      
                    <div className="booking-steps" data-aos="fade-up" data-aos-delay="300">
                      <div className="step">
                        <div className="step-icon">
                          <i className="bi bi-calendar-check"></i>
                        </div>
                        <div className="step-content">
                          <h4>Select Service</h4>
                          <p>Choose the medical service you need</p>
                        </div>
                      </div>
                      <div className="step">
                        <div className="step-icon">
                          <i className="bi bi-clock"></i>
                        </div>
                        <div className="step-content">
                          <h4>Pick Date &amp; Time</h4>
                          <p>Select your preferred appointment slot</p>
                        </div>
                      </div>
                      <div className="step">
                        <div className="step-icon">
                          <i className="bi bi-person-check"></i>
                        </div>
                        <div className="step-content">
                          <h4>Confirm Details</h4>
                          <p>Provide your information and confirm</p>
                        </div>
                      </div>
                    </div>
      
                    <div className="appointment-form" data-aos="fade-up" data-aos-delay="400">
                      <form action="forms/book-appointment.php" method="post" className="php-email-form">
                        <div className="row gy-4">
                          <div className="col-md-6">
                            <input type="text" name="name" className="form-control" placeholder="Full Name" required />
                          </div>
                          <div className="col-md-6">
                            <input type="email" name="email" className="form-control" placeholder="Email Address" required />
                          </div>
                          <div className="col-md-6">
                            <input type="tel" name="phone" className="form-control" placeholder="Phone Number" required />
                          </div>
                          <div className="col-md-6">
                            <select name="department" className="form-select" required>
                              <option value="">Select Department</option>
                              <option value="general">General Consultation</option>
                              <option value="cardiology">Cardiology</option>
                              <option value="neurology">Neurology</option>
                              <option value="orthopedics">Orthopedics</option>
                              <option value="pediatrics">Pediatrics</option>
                              <option value="dermatology">Dermatology</option>
                              <option value="oncology">Oncology</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <input type="date" name="date" className="form-control" required />
                          </div>
                          <div className="col-md-6">
                            <select name="doctor" className="form-select" required>
                              <option value="">Select Doctor</option>
                              <option value="dr-sarah-johnson">Dr. Sarah Johnson</option>
                              <option value="dr-michael-chen">Dr. Michael Chen</option>
                              <option value="dr-emily-davis">Dr. Emily Davis</option>
                              <option value="dr-robert-smith">Dr. Robert Smith</option>
                              <option value="dr-lisa-brown">Dr. Lisa Brown</option>
                              <option value="dr-david-wilson">Dr. David Wilson</option>
                              <option value="dr-maria-rodriguez">Dr. Maria Rodriguez</option>
                            </select>
                          </div>
                          <div className="col-12">
                            <textarea name="message" className="form-control" rows={4}
                              placeholder="Additional notes or symptoms (optional)"></textarea>
                          </div>
                          <div className="col-12">
                            <div className="loading">Loading</div>
                            <div className="error-message"></div>
                            <div className="sent-message">Your appointment has been scheduled. Thank you!</div>
                            <button type="submit" className="btn-book">Book Appointment Now</button>
                          </div>
                        </div>
                      </form>
                    </div>
      
                    <div className="emergency-info" data-aos="fade-up" data-aos-delay="500">
                      <p><i className="bi bi-exclamation-triangle"></i> For medical emergencies, please call <strong>911</strong>
                        or go to the nearest emergency room.</p>
                    </div>
      
                  </div>
                </div>
              </div>
      
            </div>
      
          </section>{/* /Appointmnet Section */}
      
        </main>
      <Footer />
    </div>
  );
}
