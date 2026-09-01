import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Mail, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../utils/supabase';

export default function EmailVerification() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const pendingEmail = sessionStorage.getItem('pending_verification_email');
    if (!pendingEmail) {
      navigate('/register');
      return;
    }
    setEmail(pendingEmail);
  }, [navigate]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        setConfirmed(true);
      }
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  const checkVerification = async () => {
    setChecking(true);
    setError('');
    try {
      // Try signing in — works if email is confirmed (even without a prior session)
      const password = sessionStorage.getItem('pending_verification_password');
      if (password) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!signInError && data?.user?.email_confirmed_at) {
          setConfirmed(true);
          setChecking(false);
          return;
        }
        if (signInError) {
          setError(signInError.message || 'Login failed. Make sure you confirmed your email and try again.');
          setChecking(false);
          return;
        }
      }
      setError('Email not confirmed yet. Check your inbox (and spam folder), click the confirmation link, then try again.');
    } catch (err: any) {
      setError(err.message || 'Failed to check verification status');
    } finally {
      setChecking(false);
    }
  };

  const handleContinue = async () => {
    const password = sessionStorage.getItem('pending_verification_password');
    sessionStorage.removeItem('pending_verification_email');
    sessionStorage.removeItem('pending_verification_password');
    try {
      if (password) {
        const { data } = await supabase.auth.signInWithPassword({ email, password });
        if (data?.user) {
          localStorage.setItem('vendlocate_current_user', JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email,
          }));
        }
      }
    } catch {}
    navigate('/pricing');
  };

  const handleResend = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      setError('Confirmation email resent! Check your inbox (and spam folder).');
    } catch (err: any) {
      setError(err.message || 'Failed to resend. You may need to configure SMTP in your Supabase dashboard.');
    }
  };

  if (confirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Verified!</h1>
            <p className="text-gray-600 mb-6">Your email has been successfully confirmed.</p>
            <button
              onClick={handleContinue}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Continue to Pricing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
            <p className="text-gray-600 mb-2">
              We sent a confirmation email to
            </p>
            <p className="text-gray-900 font-medium">{email}</p>
          </div>

          {error && (
            <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Click the confirmation link in the email, then come back and click the button below.
            </p>

            <button
              onClick={checkVerification}
              disabled={checking}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {checking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  I've Confirmed My Email
                </>
              )}
            </button>

            <div className="text-center">
              <button
                onClick={handleResend}
                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                Resend confirmation email
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
