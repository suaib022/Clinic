// @vitest-environment jsdom
// Lab staff sign-in: where each role lands, and the Lab tab on the login page (no demo credentials).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { homeFor } from '@/lib/auth/home';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import LoginForm from '@/app/login/LoginForm';

afterEach(() => { cleanup(); push.mockReset(); vi.unstubAllGlobals(); });

describe('homeFor', () => {
  it('sends every role to its own area', () => {
    expect(homeFor('admin')).toBe('/admin/dashboard');
    expect(homeFor('doctor')).toBe('/doctor/dashboard');
    expect(homeFor('compounder')).toBe('/compounder/dashboard');
    expect(homeFor('patient')).toBe('/patient/dashboard');
    expect(homeFor('technician')).toBe('/lab/dashboard');
  });
  it('unknown or missing role goes to the home page', () => {
    expect(homeFor(null)).toBe('/');
    expect(homeFor(undefined)).toBe('/');
  });
});

describe('login page: Lab tab', () => {
  it('shows a Lab tab with empty fields (no demo credentials)', () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Lab' }));
    expect((screen.getByPlaceholderText('Lab Staff Email Address') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('Password') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Login as Lab Staff' })).toBeTruthy();
  });

  it('signs in through the staff login API and goes to the lab area', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, user: { role: 'technician' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Lab' }));
    fireEvent.change(screen.getByPlaceholderText('Lab Staff Email Address'), { target: { value: 'lab_1@staff.clinic.local' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'a-long-test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login as Lab Staff' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/lab/dashboard'));
    expect(fetchMock).toHaveBeenCalledWith('/api/doctor/login', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body).toEqual({ identifier: 'lab_1@staff.clinic.local', pin: 'a-long-test-password', role: 'technician' });
  });

  it('a refused sign-in shows the error and does not navigate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })));
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Lab' }));
    fireEvent.change(screen.getByPlaceholderText('Lab Staff Email Address'), { target: { value: 'x@y.z' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'whatever-it-is' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login as Lab Staff' }));
    expect(await screen.findByText('Access denied')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
