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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://script.google.com/macros/s/AKfycbwDvp1ET8rsaNxqYMkzYQlWgn6l6qM_r2M9ukZgBBqHZj1rMIxZcd8x920MVd8J-SA08Q/exec';

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const pendingCount = useMemo(() => licenses.filter((license) => license.status === 'pending').length, [licenses]);

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
    try {
      await callApi({ path: 'admin-login', password: adminPassword });
      setIsAuthenticated(true);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Password Admin salah');
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
      <div className="relative flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#2563eb_0,_transparent_34%),radial-gradient(circle_at_bottom_right,_#7c3aed_0,_transparent_32%),linear-gradient(135deg,_#020617,_#0f172a_45%,_#111827)] px-6 py-10 text-white">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden lg:block">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-cyan-100 shadow-2xl shadow-cyan-950/30 backdrop-blur">
              <Sparkles size={16} /> License Management Console
            </div>
            <h1 className="max-w-xl text-5xl font-black leading-tight tracking-tight">
              Kelola aktivasi lisensi dengan cepat dan aman.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">
              Approve user baru, revoke akses, pantau device UID, dan lindungi fitur Pro Video Clipper dari satu dashboard admin.
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {['Pending approval', 'Device lock', 'Audit ready'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-sm text-slate-200 backdrop-blur">
                  <ShieldCheck className="mb-3 text-emerald-300" size={22} />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-2 shadow-2xl shadow-black/30 backdrop-blur-2xl">
              <div className="rounded-[1.6rem] bg-white p-8 text-slate-900 shadow-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">ClipForge</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight">Admin Login</h2>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                    <Lock size={26} />
                  </div>
                </div>

                <p className="mb-6 text-sm leading-6 text-slate-500">
                  Masukkan password admin yang sama dengan Script Properties <span className="font-semibold text-slate-700">ADMIN_PASSWORD</span> di Google Apps Script.
                </p>

                {loginError && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 shrink-0" size={18} />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleAdminLogin} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Admin Password</label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        placeholder="Masukkan password admin"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60">
                    Masuk Dashboard
                    <ArrowRight className="transition group-hover:translate-x-1" size={18} />
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
