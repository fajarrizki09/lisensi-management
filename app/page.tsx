'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, Lock, RefreshCw, Shield, ShieldCheck, Smartphone, Sparkles, XCircle } from 'lucide-react';

type LicenseRow = {
  id: string;
  user_id: string;
  email: string;
  plan: string;
  status: string;
  device_uid: string;
  max_devices: string;
  expires_at: string;
  created_at: string;
  last_checked_at: string;
  mismatch_count: string;
  effective_status?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/license';
const ADMIN_SESSION_KEY = 'clipforge-admin-session';
const ADMIN_PASSWORD_KEY = 'clipforge-admin-password';

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const pendingCount = useMemo(() => licenses.filter((license) => license.status === 'pending').length, [licenses]);

  useEffect(() => {
    try {
      const savedSession = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
      const savedPassword = window.sessionStorage.getItem(ADMIN_PASSWORD_KEY);
      if (savedSession === 'active' && savedPassword) {
        setAdminPassword(savedPassword);
        setIsAuthenticated(true);
      }
    } catch (error) {
      // Session storage tidak tersedia; tetap tampilkan login normal.
    }
  }, []);

  const callApi = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || data.error || 'Request gagal');
    return data;
  }, []);

  const loadLicenses = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await callApi({ path: 'list-licenses', admin_password: adminPassword });
      setLicenses(Array.isArray(data.licenses) ? data.licenses : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal load licenses');
    } finally {
      setLoading(false);
    }
  }, [adminPassword, callApi]);

  useEffect(() => {
    if (isAuthenticated) loadLicenses();
  }, [isAuthenticated, loadLicenses]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      await callApi({ path: 'admin-login', password: adminPassword });
      try {
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'active');
        window.sessionStorage.setItem(ADMIN_PASSWORD_KEY, adminPassword);
      } catch (storageError) {}
      setIsAuthenticated(true);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Password Admin salah');
    } finally {
      setLoading(false);
    }
  };

  const setLicenseStatus = async (license: LicenseRow, status: 'active' | 'pending' | 'revoked' | 'suspended') => {
    setLoading(true);
    setMessage('');
    try {
      await callApi({ path: 'set-license-status', license_id: license.id, status, admin_password: adminPassword });
      setMessage(`${license.email} -> ${status}`);
      await loadLicenses();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal update status');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-shell" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '32px', color: '#fff', background: 'radial-gradient(circle at 12% 10%, rgba(37,99,235,.72), transparent 34%), radial-gradient(circle at 88% 88%, rgba(124,58,237,.58), transparent 32%), linear-gradient(135deg, #020617 0%, #0f172a 48%, #111827 100%)', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ position: 'absolute', left: '50%', top: '-120px', width: 420, height: 420, transform: 'translateX(-50%)', borderRadius: 999, background: 'rgba(34,211,238,.18)', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', right: '-80px', bottom: '-80px', width: 360, height: 360, borderRadius: 999, background: 'rgba(217,70,239,.18)', filter: 'blur(70px)' }} />
        <div style={{ position: 'relative', width: '100%', maxWidth: 1120, display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(360px,.95fr)', gap: 48, alignItems: 'center' }}>
          <section className="login-hero" style={{ display: 'block' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '10px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.10)', color: '#cffafe', fontSize: 14, boxShadow: '0 20px 60px rgba(8,47,73,.25)', backdropFilter: 'blur(14px)' }}>
              <Sparkles size={16} /> License Management Console
            </div>
            <h1 style={{ maxWidth: 600, margin: 0, fontSize: 56, lineHeight: 1.02, letterSpacing: '-.045em', fontWeight: 900 }}>
              Kelola aktivasi lisensi dengan cepat dan aman.
            </h1>
            <p style={{ maxWidth: 560, marginTop: 22, color: '#cbd5e1', fontSize: 18, lineHeight: 1.8 }}>
              Approve user baru, revoke akses, pantau device UID, dan lindungi fitur Pro Video Clipper dari satu dashboard admin.
            </p>
            <div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, maxWidth: 590 }}>
              {['Pending approval', 'Device lock', 'Audit ready'].map((item) => (
                <div key={item} style={{ minHeight: 88, borderRadius: 22, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.075)', padding: 18, color: '#e2e8f0', fontSize: 14, backdropFilter: 'blur(12px)' }}>
                  <ShieldCheck style={{ display: 'block', marginBottom: 12, color: '#6ee7b7' }} size={23} />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section style={{ width: '100%', maxWidth: 460, margin: '0 auto' }}>
            <div style={{ borderRadius: 34, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.10)', padding: 8, boxShadow: '0 30px 90px rgba(0,0,0,.36)', backdropFilter: 'blur(22px)' }}>
              <div style={{ borderRadius: 26, background: '#fff', padding: 34, color: '#0f172a', boxShadow: '0 22px 45px rgba(15,23,42,.18)' }}>
                <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
                  <div>
                    <p style={{ margin: 0, color: '#2563eb', fontSize: 13, fontWeight: 800, letterSpacing: '.20em', textTransform: 'uppercase' }}>ClipForge</p>
                    <h2 style={{ margin: '8px 0 0', fontSize: 30, lineHeight: 1.1, fontWeight: 900, letterSpacing: '-.035em' }}>Admin Login</h2>
                  </div>
                  <div style={{ width: 58, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 20, background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', boxShadow: '0 14px 28px rgba(37,99,235,.34)' }}>
                    <Lock size={26} />
                  </div>
                </div>

                <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14, lineHeight: 1.7 }}>
                  Masukkan password admin yang sama dengan Script Properties <span style={{ color: '#334155', fontWeight: 800 }}>ADMIN_PASSWORD</span> di Google Apps Script.
                </p>

                {loginError && (
                  <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: 18, border: '1px solid #fecaca', background: '#fef2f2', padding: 16, color: '#b91c1c', fontSize: 14 }}>
                    <AlertCircle style={{ marginTop: 2, flexShrink: 0 }} size={18} />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleAdminLogin} style={{ display: 'grid', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 9, color: '#334155', fontSize: 14, fontWeight: 800 }}>Admin Password</label>
                    <div style={{ position: 'relative' }}>
                      <KeyRound style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} size={19} />
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', borderRadius: 18, border: '1px solid #e2e8f0', background: '#f8fafc', padding: '16px 16px 16px 48px', color: '#0f172a', outline: 'none', fontSize: 15, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.8)' }}
                        placeholder="Masukkan password admin"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 0, borderRadius: 18, background: 'linear-gradient(135deg,#2563eb,#4f46e5)', padding: '16px 20px', color: '#fff', fontWeight: 900, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 18px 32px rgba(37,99,235,.28)', opacity: loading ? .65 : 1 }}>
                    {loading ? 'Memeriksa password...' : 'Masuk Dashboard'}
                    <ArrowRight size={18} />
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">ClipForge Admin</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">License Approval</h2>
          <p className="text-sm text-slate-500">User daftar dari app → muncul pending di sini → admin aktif/nonaktif.</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">{pendingCount} pending</span>}
          <button onClick={() => { window.sessionStorage.removeItem(ADMIN_SESSION_KEY); window.sessionStorage.removeItem(ADMIN_PASSWORD_KEY); setIsAuthenticated(false); setAdminPassword(''); setLicenses([]); }} className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-slate-600 hover:bg-slate-50">
            Logout
          </button>
          <button onClick={loadLicenses} disabled={loading} className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {message && <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="p-4 font-medium text-gray-500">Email</th>
              <th className="p-4 font-medium text-gray-500">Plan</th>
              <th className="p-4 font-medium text-gray-500">Status</th>
              <th className="p-4 font-medium text-gray-500">Device</th>
              <th className="p-4 font-medium text-gray-500">Expires</th>
              <th className="p-4 font-medium text-gray-500">Mismatch</th>
              <th className="p-4 font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {licenses.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">Belum ada pendaftaran license.</td></tr>
            )}
            {licenses.map((license) => (
              <tr key={license.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-4">
                  <div className="font-medium text-gray-900">{license.email || '-'}</div>
                  <div className="font-mono text-xs text-gray-400">{license.id}</div>
                </td>
                <td className="p-4 capitalize"><span className="rounded bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">{license.plan || '-'}</span></td>
                <td className="p-4"><StatusBadge status={license.status} /></td>
                <td className="max-w-xs p-4"><div className="flex items-center gap-2 text-gray-600"><Smartphone size={16} /><span className="truncate font-mono text-xs">{license.device_uid || '-'}</span></div></td>
                <td className="p-4 text-gray-600">{license.expires_at || '-'}</td>
                <td className="p-4 text-gray-600">{license.mismatch_count || '0'}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setLicenseStatus(license, 'active')} disabled={loading} className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60">ACC Aktif</button>
                    <button onClick={() => setLicenseStatus(license, 'suspended')} disabled={loading} className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60">Nonaktif</button>
                    <button onClick={() => setLicenseStatus(license, 'revoked')} disabled={loading} className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60">Revoke</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = status === 'active' ? 'bg-green-100 text-green-700' : status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  const icon = status === 'active' ? <Shield size={12} /> : status === 'pending' ? <AlertCircle size={12} /> : status === 'revoked' ? <XCircle size={12} /> : <CheckCircle2 size={12} />;
  return <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${style}`}>{icon}{status || '-'}</span>;
}
