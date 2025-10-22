import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import * as onlineService from '../services/onlineService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logOut = async () => {
    if (user) {
        // Update presence to offline before signing out
        await onlineService.goOffline(user.uid);
    }
    await auth.signOut();
  };

  const value = {
    user,
    loading,
    logOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
