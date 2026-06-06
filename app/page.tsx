'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, RefreshCw, Shield, Smartphone, XCircle } from 'lucide-react';

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
      const data = await callApi({ path: 'list-licenses' });
      setLicenses(Array.isArray(data.licenses) ? data.licenses : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal load licenses');
    } finally {
      setLoading(false);
    }
  }, [callApi]);

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
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
          <div className="mb-4 flex justify-center text-blue-600"><Lock size={40} /></div>
          <h2 className="mb-6 text-center text-xl font-bold text-gray-800">Admin Authentication</h2>
          {loginError && <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{loginError}</div>}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Admin Password</label>
              <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full rounded border p-2 text-black" placeholder="Enter password..." required />
              <p className="mt-1 text-xs text-gray-400">Sesuai Script Properties: ADMIN_PASSWORD</p>
            </div>
            <button type="submit" className="w-full rounded bg-blue-600 p-2 font-medium text-white transition hover:bg-blue-700">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">License Approval</h2>
          <p className="text-sm text-gray-500">User daftar dari app → muncul pending di sini → admin aktif/nonaktif.</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">{pendingCount} pending</span>}
          <button onClick={loadLicenses} disabled={loading} className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {message && <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
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
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = status === 'active' ? 'bg-green-100 text-green-700' : status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  const icon = status === 'active' ? <Shield size={12} /> : status === 'pending' ? <AlertCircle size={12} /> : status === 'revoked' ? <XCircle size={12} /> : <CheckCircle2 size={12} />;
  return <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${style}`}>{icon}{status || '-'}</span>;
}
