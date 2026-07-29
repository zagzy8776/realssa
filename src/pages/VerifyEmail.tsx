import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import axios from 'axios';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage('No verification token provided in URL.');
      return;
    }

    axios
      .get(`/api/auth/verify-email?token=${token}`)
      .then((res) => {
        setSuccess(true);
        setMessage('Your email has been verified successfully! Your account is now fully active.');
      })
      .catch((err) => {
        setSuccess(false);
        setMessage(err.response?.data?.error || 'Invalid or expired verification link.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEO title="Verify Email | RealSSA News" description="Verify your RealSSA account email address." />
      <Header />

      <main className="flex-1 container max-w-md mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <div className="w-full bg-card border border-border rounded-3xl p-8 shadow-xl space-y-6">
          
          {loading ? (
            <div className="py-8 space-y-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <h2 className="text-xl font-bold">Verifying Your Account...</h2>
              <p className="text-sm text-muted-foreground">Please wait while we confirm your email verification token.</p>
            </div>
          ) : success ? (
            <div className="py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Email Verified!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-90 transition-all"
              >
                Go to Profile <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Verification Failed</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-all"
              >
                Return to Home
              </Link>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
