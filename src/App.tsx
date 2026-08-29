import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router';
import React, { useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import { Loader2, QrCode, Eye, EyeOff } from 'lucide-react';

export interface AdminUser {
  uid: string;
  username: string;
}

function SetupQr({ user }: { user: AdminUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [seqNumber, setSeqNumber] = useState<number | null>(null);
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
          if (data.link.sequenceNumber !== undefined && data.link.sequenceNumber !== null) {
            setSeqNumber(data.link.sequenceNumber);
          }
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
    <div className="max-w-md mx-auto my-4 sm:my-10 px-3 sm:px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-5 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <QrCode size={22} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Assign QR Code</h2>
              {seqNumber !== null && (
                <span className="bg-blue-600 text-white font-mono text-xs font-bold px-2 py-0.5 rounded-md shadow-xs">
                  #{String(seqNumber).padStart(2, '0')}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs sm:text-sm">Set the destination for this QR code.</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Destination URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-slate-50 focus:bg-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Label (e.g. Business Name)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Business"
              className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-slate-50 focus:bg-white"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={saving || !url || !name}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 sm:py-3.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer active:scale-[0.98]"
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
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-3 sm:p-4 font-sans">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="flex justify-center mb-5 sm:mb-6">
            <img src="/logo.png" alt="TapX Logo" className="h-16 sm:h-20 w-auto object-contain drop-shadow-xs" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6 sm:mb-7">Admin Login</h1>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 ml-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-slate-50 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 pr-11 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-slate-50 focus:bg-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="bg-red-50 text-red-600 text-xs font-medium p-3 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-1">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold py-3 sm:py-3.5 px-4 rounded-xl transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 mt-2 text-sm sm:text-base cursor-pointer"
            >
              {isLoggingIn ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-100">
            <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold">
              Restricted Access Area
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 flex justify-between items-center sticky top-0 z-20 shadow-xs">
        <div className="font-bold text-slate-800 flex items-center gap-2.5 text-sm sm:text-base">
          <img src="/logo.png" alt="TapX Logo" className="h-8 sm:h-9 w-auto object-contain shrink-0" />
          <span className="truncate">TapX</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-medium hidden sm:inline">Admin</span>
          <button 
            onClick={handleLogout} 
            className="text-xs sm:text-sm font-medium text-slate-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-slate-200 sm:border-transparent transition-colors cursor-pointer"
          >
            Logout
          </button>
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

