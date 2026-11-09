// Dev-only DSS test accounts (no passwords here: the shared password is DSS_TEST_PASSWORD in .env.local).
export const DSS_TEST_ACCOUNTS = {
  admin: { email: 'dss.admin@clinic.test', name: 'DSS Test Admin', role: 'admin' },
  doctorA: { email: 'dss.doctor.a@clinic.test', name: 'Dr. DSS Rahman (Test)', role: 'doctor' },
  doctorB: { email: 'dss.doctor.b@clinic.test', name: 'Dr. DSS Karim (Test)', role: 'doctor' },
  compA1: { email: 'dss.comp.a1@clinic.test', name: 'DSS Compounder A1', role: 'compounder' },
  compA2: { email: 'dss.comp.a2@clinic.test', name: 'DSS Compounder A2', role: 'compounder' },
  compB: { email: 'dss.comp.b@clinic.test', name: 'DSS Compounder B', role: 'compounder' },
  patient1: { email: 'dss.patient.1@clinic.test', name: 'DSS Patient One', role: 'patient' },
  patient2: { email: 'dss.patient.2@clinic.test', name: 'DSS Patient Two', role: 'patient' },
} as const;
export type DssTestAccount = keyof typeof DSS_TEST_ACCOUNTS;

/** Quick login is available only with DSS_DEV_SEED=1, a test password, and a request to localhost. */
export function devLoginEnabled(host: string | null): boolean {
  const local = !!host && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  // NODE_ENV guard: the Host header is client-controlled, so the env flags alone must never enable this in production.
  return process.env.NODE_ENV !== 'production' && process.env.DSS_DEV_SEED === '1' && !!process.env.DSS_TEST_PASSWORD && local;
}
