import Link from "next/link";
import LoginForm from "./LoginForm";

import { login } from "../auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams?.error as string;
  const message = resolvedSearchParams?.message as string;

  return (
    <div className="login-page d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", backgroundColor: "#f6f9ff" }}>
      <main className="main w-100">
        <section id="login" className="section py-5">
          <div className="container" data-aos="fade-up" data-aos-delay="100">
            <div className="row">
              <div className="col-lg-4 col-md-6 mx-auto">
                
                <div className="text-center mb-4">
                  <h1 className="sitename" style={{ fontSize: "32px", fontWeight: "700", color: "var(--heading-color)" }}>Clinic</h1>
                </div>

                <LoginForm error={error} message={message} />
                
                
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
