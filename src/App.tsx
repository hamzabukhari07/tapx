import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router';
import React, { useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import { Loader2, QrCode } from 'lucide-react';

export interface AdminUser {
  uid: string;
  username: string;
}

function SetupQr({ user }: { user: AdminUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function checkDoc() {
      if (!id) return;
      try {
        const response = await fetch(`/api/qr-links/${id}`);
        const data = await response.json();
        if (response.ok && data.link) {
          setUrl(data.link.destinationUrl || '');
          const existingName = data.link.businessName;
          setName(existingName === 'Unassigned QR Code' ? '' : existingName || '');
        } else {
          setError(data.error || 'QR code not found.');
        }
      } catch (e) {
        console.error(e);
        setError("Error loading QR code data.");
      } finally {
        setLoading(false);
      }
    }
    checkDoc();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !name.trim()) return;
    setSaving(true);
    setError('');

    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl) && !formattedUrl.startsWith('/')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      const response = await fetch(`/api/qr-links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationUrl: formattedUrl,
          businessName: name.trim()
        })
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        navigate('/');
      } else {
        setError(data?.error || 'Failed to save assignment.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save assignment.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 bg-red-50 p-4 rounded-lg inline-block border border-red-100">{error}</p>
        <div className="mt-6">
          <button onClick={() => navigate('/')} className="text-blue-600 hover:underline text-sm font-medium">Return to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <QrCode size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Assign QR Code</h2>
            <p className="text-slate-500 text-sm">Set the destination for this QR code.</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Destination URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Label (e.g. Business Name)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Business"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={saving || !url || !name}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : 'Save & Activate'}
          </button>
        </form>
      </div>
    </div>
  );
}

function MainApp() {
  const [user, setUser] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem('qr_admin_auth');
    if (saved === 'true') {
      return { uid: 'admin', username: 'admin' };
    }
    return null;
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('qr_admin_auth', 'true');
        setUser({ uid: 'admin', username: 'admin' });
      } else {
        setLoginError(data.error || 'Invalid username or password.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Login server unreachable. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('qr_admin_auth');
    setUser(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <QrCode size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Admin Login</h1>
          <p className="text-slate-500 text-sm mb-8">Access the dynamic QR management panel.</p>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-slate-50 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-slate-50 focus:bg-white"
                required
              />
            </div>

            {loginError && (
              <div className="bg-red-50 text-red-600 text-xs font-medium p-3 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-1">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
            >
              {isLoggingIn ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold">
              Restricted Access Area
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="font-bold text-slate-800 flex items-center gap-2">
          <QrCode size={18} className="text-blue-600" />
          Dynamic QR Admin
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 hidden md:inline">Admin</span>
          <button onClick={handleLogout} className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">Logout</button>
        </div>
      </div>
      
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/setup/:id" element={<SetupQr user={user} />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}

