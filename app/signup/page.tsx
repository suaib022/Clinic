import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="signup-page d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", backgroundColor: "#f6f9ff" }}>
      <main className="main w-100">
        <section id="signup" className="section py-5">
          <div className="container" data-aos="fade-up" data-aos-delay="100">
            <div className="row">
              <div className="col-lg-5 col-md-8 mx-auto">
                
                <div className="text-center mb-4">
                  <h1 className="sitename" style={{ fontSize: "32px", fontWeight: "700", color: "var(--heading-color)" }}>Clinic</h1>
                </div>

                <div className="booking-wrapper" style={{ padding: "40px", backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0px 0px 20px rgba(1, 41, 112, 0.1)" }}>
                  <div className="booking-header text-center mb-4">
                    <h2 style={{ fontSize: "24px", fontWeight: "600" }}>Create an Account</h2>
                    <p className="text-muted small">Enter your details to create your account</p>
                  </div>

                  <div className="appointment-form">
                    <form action="#" method="post" className="php-email-form">
                      <div className="row gy-4">
                        <div className="col-12">
                          <label className="form-label" style={{ fontWeight: "600" }}>Full Name</label>
                          <input type="text" name="name" className="form-control" placeholder="Full Name" required />
                        </div>
                        <div className="col-12">
                          <label className="form-label" style={{ fontWeight: "600" }}>Email</label>
                          <input type="email" name="email" className="form-control" placeholder="Email Address" required />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label" style={{ fontWeight: "600" }}>Password</label>
                          <input type="password" name="password" className="form-control" placeholder="Password" required />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label" style={{ fontWeight: "600" }}>Confirm Password</label>
                          <input type="password" name="confirm_password" className="form-control" placeholder="Confirm Password" required />
                        </div>
                        
                        <div className="col-12 mt-4">
                          <button type="submit" className="btn-book" style={{ width: "100%", padding: "12px 20px", border: "none", borderRadius: "4px", background: "var(--accent-color)", color: "#fff", fontWeight: "600" }}>Sign Up</button>
                        </div>
                        
                        <div className="col-12 text-center mt-3">
                          <p className="small mb-0">Already have an account? <Link href="/login" style={{ color: "var(--accent-color)", fontWeight: "600" }}>Login</Link></p>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
                
                <div className="text-center mt-4">
                   <Link href="/" className="small text-muted"><i className="bi bi-arrow-left"></i> Back to Home</Link>
                </div>

              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
