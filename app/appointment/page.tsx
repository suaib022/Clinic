import React from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppointmentClient from "./AppointmentClient";

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
                  <h1 className="heading-title">Book an Appointment</h1>
                </div>
              </div>
            </div>
          </div>
        </div>
        <section className="cl-book-section">
          <AppointmentClient />
        </section>
      </main>
      <Footer />
    </div>
  );
}
