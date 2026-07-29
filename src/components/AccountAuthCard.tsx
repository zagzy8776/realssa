import { useState, useEffect } from 'react';
import { LogIn, UserPlus, Shield, Smartphone, Mail, Lock, CheckCircle2, ArrowRight, LogOut } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import axios from 'axios';

export default function AccountAuthCard() {
  const [user, setUser] = useState<{ username?: string; email?: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('realssa_auth_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (_) {}
    }
  }, []);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      toast({ title: 'Invalid Phone Number', description: 'Please enter a valid phone number.' });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
      toast({ title: 'Verification Code Sent', description: 'Check your phone for your 4-digit OTP code.' });
    }, 1000);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      toast({ title: 'Invalid Code', description: 'Enter the 4-digit code sent to your phone.' });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const userData = { username: `User-${phone.slice(-4)}`, phone };
      localStorage.setItem('realssa_auth_user', JSON.stringify(userData));
      setUser(userData);
      setLoading(false);
      setIsOpen(false);
      toast({ title: 'Account Verified', description: 'Your points and streaks are now linked!' });
    }, 1000);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: 'Missing fields', description: 'Please fill in all fields.' });
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/api/register' : '/api/login';
      const res = await axios.post(endpoint, { username, password });
      if (res.data && res.data.token) {
        localStorage.setItem('realssa_jwt_token', res.data.token);
        const userData = { username, email: username };
        localStorage.setItem('realssa_auth_user', JSON.stringify(userData));
        setUser(userData);
        setIsOpen(false);
        toast({ title: mode === 'signup' ? 'Account Created' : 'Signed In', description: 'Welcome to RealSSA!' });
      } else {
        toast({ title: 'Auth Failed', description: res.data?.error || 'Could not authenticate.' });
      }
    } catch (err: any) {
      toast({ title: 'Auth Error', description: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('realssa_auth_user');
    localStorage.removeItem('realssa_jwt_token');
    setUser(null);
    toast({ title: 'Signed Out', description: 'You are now browsing in Guest Mode.' });
  };

  return (
    <div className="w-full bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 text-card-foreground">
      
      {/* Current Account Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${user ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'}`}>
            {user ? <CheckCircle2 className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">
              {user ? user.username : 'Guest Reader Account'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {user ? 'Account Linked & Verified' : 'Device Linked (Guest Mode)'}
            </p>
          </div>
        </div>

        {user ? (
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 hover:bg-muted transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In / Up</span>
          </button>
        )}
      </div>

      {/* Guest Mode Invitation Banner */}
      {!user && (
        <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 text-xs text-muted-foreground leading-relaxed space-y-2">
          <p>
            Sign in to sync your RealSSA Points (RP), daily reading streaks, and saved bookmarks across all your phones and browsers.
          </p>
        </div>
      )}

      {/* Auth Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-5 text-card-foreground">
            
            {/* Header Tabs */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`text-sm font-bold pb-1 border-b-2 transition-all ${
                    mode === 'signin' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                  }`}
                >
                  Sign In
                </button>
                <span className="text-muted-foreground">/</span>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`text-sm font-bold pb-1 border-b-2 transition-all ${
                    mode === 'signup' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>

            {/* Method Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setAuthMethod('phone')}
                className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  authMethod === 'phone' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Phone OTP
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('email')}
                className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  authMethod === 'email' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
            </div>

            {/* Phone Method Form */}
            {authMethod === 'phone' && (
              !otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-3">
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-muted-foreground">Mobile Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 08012345678"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    {loading ? 'Sending...' : 'Send Verification Code'} <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-muted-foreground">Enter 4-Digit Code</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="1234"
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-center text-lg font-bold tracking-widest focus:outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    {loading ? 'Verifying...' : 'Verify & Link Account'} <CheckCircle2 className="w-4 h-4" />
                  </button>
                </form>
              )
            )}

            {/* Email Method Form */}
            {authMethod === 'email' && (
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="space-y-1 text-left">
                  <label className="text-xs font-semibold text-muted-foreground">Username or Email</label>
                  <input
                    type="text"
                    placeholder="Enter username or email"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-xs font-semibold text-muted-foreground">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {loading ? 'Authenticating...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
