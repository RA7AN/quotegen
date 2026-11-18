// @vitest-environment jsdom
/**
 * #39 — DOM tests for the show-password reveal toggle.
 *
 * Covers the PasswordField behaviour the pure-state tests can't reach: the input
 * starts masked and flips to text on toggle, the button's accessible name +
 * aria-pressed track the state, the typed value survives a reveal, and each field
 * toggles independently. Also asserts the sign-up page wires PasswordField in.
 *
 * Plain DOM assertions only — this repo has no jest-dom matchers installed.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PasswordField } from './fields';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/auth/client', () => ({
  authClient: { signIn: { email: vi.fn() }, signUp: { email: vi.fn() } },
}));

// FieldShell wraps the control in a <label>, so the label text also carries the
// hint (e.g. "Password At least 8 characters"). Match by substring, not exact.
const input = (re: RegExp) => screen.getByLabelText(re) as HTMLInputElement;

function Harness() {
  const [pw, setPw] = useState('');
  return <PasswordField label="Password" name="password" value={pw} onChange={setPw} />;
}

afterEach(cleanup);

describe('PasswordField reveal toggle', () => {
  it('starts masked with a "Show password" control', () => {
    render(<Harness />);
    expect(input(/Password/).type).toBe('password');
    const btn = screen.getByRole('button', { name: 'Show password' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('flips the input type and the button state, preserving the typed value', () => {
    render(<Harness />);
    fireEvent.change(input(/Password/), { target: { value: 's3cret' } });
    expect(input(/Password/).value).toBe('s3cret');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input(/Password/).type).toBe('text');
    expect(input(/Password/).value).toBe('s3cret'); // value survived the toggle
    const hide = screen.getByRole('button', { name: 'Hide password' });
    expect(hide.getAttribute('aria-pressed')).toBe('true');

    // toggle back
    fireEvent.click(hide);
    expect(input(/Password/).type).toBe('password');
  });

  it('toggles each field independently', () => {
    function TwoFields() {
      const [a, setA] = useState('');
      const [b, setB] = useState('');
      return (
        <>
          <PasswordField label="Alpha" name="a" value={a} onChange={setA} />
          <PasswordField label="Bravo" name="b" value={b} onChange={setB} />
        </>
      );
    }
    render(<TwoFields />);
    // Reveal the first field only.
    fireEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0] as HTMLElement);
    expect(input(/Alpha/).type).toBe('text');
    expect(input(/Bravo/).type).toBe('password');
  });
});

describe('auth pages use PasswordField', () => {
  it('sign-up renders the reveal control on its password field', async () => {
    const { default: SignUpPage } = await import('@/app/(auth)/sign-up/page');
    render(<SignUpPage />);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeTruthy();
    expect(input(/Password/).type).toBe('password');
  });
});
