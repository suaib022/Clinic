import React from "react";
import AppointmentClient from "./AppointmentClient";

export default function AppointmentPage() {
  return (
    <div className="appointment-page" style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
      <main className="main pt-5">
        <AppointmentClient />
      </main>
    </div>
  );
}
