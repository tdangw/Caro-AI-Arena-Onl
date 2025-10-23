import React, { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInAnonymously,
    updateProfile,
    sendPasswordResetEmail
} from 'firebase/auth';
import * as onlineService from '../services/onlineService';
import { useSound } from '../hooks/useSound';
import Modal from './Modal';

const AuthScreen: React.FC = () => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [isForgotPasswordView, setIsForgotPasswordView] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { playSound } = useSound();

  useEffect(() => {
    if (!isLoginView) {
        const emailValue = email.split('@')[0];
        setUsername(emailValue);
    }
  }, [email, isLoginView]);


  const resetFormState = () => {
    setError(null);
    setSuccessMessage(null);
    setEmail('');
    setPassword('');
    setDisplayName('');
    setUsername('');
    setAgreedToTerms(false);
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    playSound('select');

    try {
      if (isLoginView) {
        // Allow login with username only, defaulting to @gmail.com
        let loginEmail = email;
        if (!email.includes('@')) {
            loginEmail = `${email}@gmail.com`;
        }
        await signInWithEmailAndPassword(auth, loginEmail, password);
      } else {
        if (!agreedToTerms) {
            throw new Error("You must agree to the Terms of Service.");
        }

        const allowedDomains = ['@gmail.com', '@yahoo.com', '@hotmail.com', '@outlook.com'];
        const domainIndex = email.indexOf('@');
        if (domainIndex === -1) {
            throw new Error("Please enter a valid email address.");
        }
        const emailDomain = email.substring(domainIndex);
        if (!allowedDomains.some(d => emailDomain.toLowerCase().endsWith(d))) {
             throw new Error("Invalid email provider. Please use Gmail, Yahoo, Hotmail, or Outlook.");
        }
        
        const trimmedDisplayName = displayName.trim();
        if (trimmedDisplayName.length < 3 || trimmedDisplayName.length > 15) {
            throw new Error("Display Name must be between 3 and 15 characters.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: trimmedDisplayName });
        await onlineService.createUserProfile(userCredential.user, trimmedDisplayName);
      }
      // onAuthStateChanged will handle the redirect
    } catch (err: any) {
      let friendlyMessage = err.message || 'An unknown error occurred.';
      if (friendlyMessage.includes('auth/invalid-credential')) {
        friendlyMessage = 'Invalid email/username or password.';
      } else if (friendlyMessage.includes('auth/email-already-in-use')) {
        friendlyMessage = 'This email is already registered. Please log in instead.';
      } else if (friendlyMessage.includes('auth/invalid-email')) {
        friendlyMessage = 'Please enter a valid email address.';
      } else if (friendlyMessage.includes('auth/weak-password')) {
        friendlyMessage = 'Password should be at least 6 characters.';
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    playSound('select');
    try {
        await sendPasswordResetEmail(auth, email);
        setSuccessMessage("Password reset email sent! Check your inbox.");
    } catch (error: any) {
        if (error.code === 'auth/invalid-email') {
            setError("Please enter a valid email address.");
        } else {
            setError("Failed to send reset email. Please check if the email is correct.");
        }
    } finally {
        setLoading(false);
    }
  };


  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    playSound('confirm');
    try {
        await signInAnonymously(auth);
    } catch(err: any) {
        setError(err.message || 'Could not sign in as guest.');
    } finally {
        setLoading(false);
    }
  };

  const renderForgotPasswordView = () => (
     <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 z-10 animate-fade-in-up">
        <h1 className="text-4xl font-bold text-cyan-400 text-center mb-2">
          Caro AI Arena
        </h1>
        <p className="text-slate-400 text-center mb-8">Reset Your Password</p>
        <form onSubmit={handlePasswordReset} className="space-y-6">
            <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {successMessage && <p className="text-green-400 text-sm">{successMessage}</p>}
            <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-lg transition-all disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
                {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
        </form>
        <div className="text-center mt-6">
          <button onClick={() => { playSound('select'); setIsForgotPasswordView(false); resetFormState(); }} className="text-cyan-400 hover:underline">
            Back to Log In
          </button>
        </div>
    </div>
  );

  const renderAuthView = () => (
     <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 z-10 animate-fade-in-up">
        <h1 className="text-4xl font-bold text-cyan-400 text-center mb-2">
          Caro AI Arena
        </h1>
        <p className="text-slate-400 text-center mb-8">{isLoginView ? 'Log in to continue' : 'Create an account'}</p>
        
        <form onSubmit={handleAuthAction} className="space-y-6">
          {!isLoginView && (
            <>
              <input
                type="text"
                placeholder="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
                minLength={3}
                maxLength={15}
              />
               <input
                type="text"
                placeholder="Username"
                value={username}
                readOnly
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-4 py-3 text-slate-400 focus:outline-none cursor-not-allowed"
              />
            </>
          )}
          <input
            type="text"
            placeholder={isLoginView ? "Email or Username" : "Email"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            required
          />
          <div className="relative">
            <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 pr-10"
                required
            />
            <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a10.05 10.05 0 015.353-5.353m-2.43-2.43A12.034 12.034 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.05 10.05 0 01-2.015 3.999m-2.228-2.228a3 3 0 11-4.242-4.242" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
            
          {isLoginView && (
            <div className="text-right -mt-4">
              <button
                type="button"
                onClick={() => { playSound('select'); setIsLoginView(false); setIsForgotPasswordView(true); resetFormState(); }}
                className="text-sm text-cyan-400 hover:underline"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {!isLoginView && (
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600 focus:ring-cyan-500 text-cyan-500"
              />
              <label htmlFor="terms" className="text-sm text-slate-400">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="text-cyan-400 hover:underline font-semibold"
                >
                  Terms of Service
                </button>
              </label>
            </div>
           )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || (!isLoginView && !agreedToTerms)}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-lg transition-all disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : (isLoginView ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div className="text-center mt-6">
          <button onClick={() => { playSound('select'); setIsLoginView(!isLoginView); resetFormState(); }} className="text-cyan-400 hover:underline">
            {isLoginView ? 'Need an account? Sign Up' : 'Already have an account? Log In'}
          </button>
        </div>
        
        {isLoginView && (
          <>
            <div className="flex items-center my-8">
                <hr className="flex-grow border-slate-600"/>
                <span className="px-4 text-slate-400">OR</span>
                <hr className="flex-grow border-slate-600"/>
            </div>

            <button
                onClick={handleGuestLogin}
                disabled={loading}
                className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50"
            >
                Continue as Guest
            </button>
          </>
        )}
      </div>
  );

  return (
    <>
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center justify-center relative">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%231e293b%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>
      {isForgotPasswordView ? renderForgotPasswordView() : renderAuthView()}
       <style>{`
            @keyframes fade-in-up {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-up { animation: fade-in-up 0.8s ease-out forwards; }
        `}</style>
    </div>

    <Modal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} title="Quy định sử dụng">
      <div className="text-slate-300 space-y-2 max-h-[60vh] overflow-y-auto pr-2">
        <ol className="list-decimal list-inside space-y-2">
            <li>Hãy tử tế và lịch sự.</li>
            <li>Tránh lời nói khó chịu hoặc bắt nạt.</li>
            <li>Không đăng quảng cáo hoặc tin rác.</li>
            <li>Tôn trọng quyền riêng tư của mọi người.</li>
            <li>Không chia sẻ tài khoản cho người khác.</li>
            <li>Không sử dụng cheat, hack, hay phần mềm gian lận.</li>
            <li>Không phát tán thông tin cá nhân của người khác.</li>
            <li>Caro AI Arena có quyền xóa tài khoản vi phạm mà không cần báo trước.</li>
        </ol>
        <div className="pt-4 flex justify-center">
             <button onClick={() => setIsTermsModalOpen(false)} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-4 rounded-lg transition-colors">
                Đã hiểu
             </button>
        </div>
      </div>
    </Modal>
    </>
  );
};

export default AuthScreen;