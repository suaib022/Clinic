import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import DoctorsClient from "./DoctorsClient";

export default async function DoctorsPage() {
  const supabase = await createClient();
  const { data: doctors, error } = await supabase.from('doctors').select('*').order('name');

  return (
    <div className="doctors-page">
      <Header />
      <main className="main">
      
          {/* Page Title */}
          <div className="page-title">
            <div className="heading">
              <div className="container">
                <div className="row d-flex justify-content-center text-center">
                  <div className="col-lg-8">
                    <h1 className="heading-title">Our Doctors</h1>
                    <p className="mb-0">
                      Meet our highly qualified team of medical professionals dedicated to providing the best care for you and your family.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>{/* End Page Title */}
      
          <DoctorsClient initialDoctors={doctors || []} />
      
        </main>
      <Footer />
    </div>
  );
}
