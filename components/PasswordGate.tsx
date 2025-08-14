'use client';

import { useEffect, useState } from 'react';

export const HARDCODED_PASSWORD = 'letmein123'; // <<< change me

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const [pw, setPw] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('pw_ok');
    if (stored === '1') setOk(true);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw === HARDCODED_PASSWORD) {
      localStorage.setItem('pw_ok', '1');
      localStorage.setItem('pw_value', pw);
      setOk(true);
    } else {
      alert('Wrong password');
    }
  }

  if (ok) return <>{children}</>;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Enter Password</h2>
      <form onSubmit={handleSubmit} className="row">
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button className="btn primary" type="submit">Unlock</button>
      </form>
      <p><small className="mono">Password is hardcoded on client (no server auth). Peers with the same password join the same room.</small></p>
    </div>
  );
}
