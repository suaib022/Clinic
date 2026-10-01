import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import DoctorsClient from "./DoctorsClient";

export default async function DoctorsPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const supabase = await createClient();
  // Fetch from legacy_doctors to preserve the old frontend listing data for now
  const { data: doctors, error } = await supabase.from('legacy_doctors').select('*, departments(name)').order('name');
  
  // Fetch departments for dynamic sidebar
  const { data: dbDepartments } = await supabase.from('departments').select('name, overview').order('name');
  const departmentsList = dbDepartments ? dbDepartments.map(d => ({ name: d.name, overview: d.overview, keywords: [] })) : [];
  
  const resolvedSearchParams = await searchParams;
  const initialDept = resolvedSearchParams?.dept || "All Departments";

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
      
          <DoctorsClient initialDoctors={doctors || []} initialDept={initialDept} dynamicDepartments={departmentsList} />
      
        </main>
      <Footer />
    </div>
  );
}
