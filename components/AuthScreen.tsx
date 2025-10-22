import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInAnonymously,
    updateProfile
} from 'firebase/auth';
import * as onlineService from '../services/onlineService';
import { useSound } from '../hooks/useSound';

const AuthScreen: React.FC = () => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { playSound } = useSound();

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    playSound('select');

    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (username.length < 3 || username.length > 15) {
            throw new Error("Username must be between 3 and 15 characters.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        await onlineService.createUserProfile(userCredential.user, username);
      }
      // onAuthStateChanged will handle the redirect
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
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
        // Let GameStateProvider handle profile creation and name syncing
        // to avoid race conditions and name mismatches.
    } catch(err: any) {
        setError(err.message || 'Could not sign in as guest.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center justify-center relative">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%231e293b%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>
      <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 z-10 animate-fade-in-up">
        <h1 className="text-4xl font-bold text-cyan-400 text-center mb-2">
          Caro AI Arena
        </h1>
        <p className="text-slate-400 text-center mb-8">{isLoginView ? 'Log in to continue' : 'Create an account'}</p>
        
        <form onSubmit={handleAuthAction} className="space-y-6">
          {!isLoginView && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-lg transition-all disabled:bg-slate-600"
          >
            {loading ? 'Processing...' : (isLoginView ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div className="text-center mt-6">
          <button onClick={() => { playSound('select'); setIsLoginView(!isLoginView); setError(null); }} className="text-cyan-400 hover:underline">
            {isLoginView ? 'Need an account? Sign Up' : 'Already have an account? Log In'}
          </button>
        </div>

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
      </div>
       <style>{`
            @keyframes fade-in-up {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-up { animation: fade-in-up 0.8s ease-out forwards; }
        `}</style>
    </div>
  );
};

export default AuthScreen;