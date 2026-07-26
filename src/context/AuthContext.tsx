import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  type User, 
  signInWithEmailAndPassword,
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean | null;
  error: string | null;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);
      if (firebaseUser) {
        const rawEmail = firebaseUser.email;
        console.log(`[Auth] Logged-in email: ${rawEmail}`);

        if (rawEmail) {
          const lowercaseEmail = rawEmail.toLowerCase();
          const docPath = `admins/${lowercaseEmail}`;
          console.log(`[Auth] Lowercase email: ${lowercaseEmail}`);
          console.log(`[Auth] Firestore document path being checked: ${docPath}`);

          try {
            const adminDocRef = doc(db, 'admins', lowercaseEmail);
            const adminDocSnap = await getDoc(adminDocRef);
            const docExists = adminDocSnap.exists();
            console.log(`[Auth] Document exists: ${docExists}`);

            if (docExists) {
              console.log(`[Auth] Authentication result: SUCCESS (Admin authorized)`);
              console.log(`[Auth] Route decision: Allow access to Dashboard`);
              setUser(firebaseUser);
              setIsAdmin(true);
            } else {
              console.log(`[Auth] Authentication result: FAILED (Unauthorized email)`);
              console.log(`[Auth] Route decision: Sign out user immediately, Redirect to Login`);
              setIsAdmin(false);
              setError("You are not authorized to access the Admin Panel.");
              // Sign out immediately so they cannot bypass
              await signOut(auth);
              setUser(null);
            }
          } catch (err: any) {
            console.error("[Auth] Error verifying admin role in Firestore:", err);
            console.log(`[Auth] Authentication result: ERROR`);
            console.log(`[Auth] Route decision: Sign out user immediately`);
            setIsAdmin(false);
            setError("Error verifying admin permissions. Please try again.");
            await signOut(auth);
            setUser(null);
          }
        } else {
          console.log(`[Auth] Authentication result: FAILED (No email found in authenticated account)`);
          console.log(`[Auth] Route decision: Sign out user immediately`);
          setIsAdmin(false);
          setError("You are not authorized to access the Admin Panel.");
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
        setIsAdmin(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    console.log(`[Auth] Initiating Email/Password login for: ${email}`);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("[Auth] Firebase email sign in error:", err);
      const errorCode = err.code;
      let userFriendlyMsg = "Failed to log in. Please check your credentials.";

      if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        userFriendlyMsg = "Incorrect password. Please try again.";
      } else if (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-email') {
        userFriendlyMsg = "User account not found.";
      } else if (errorCode === 'auth/network-request-failed') {
        userFriendlyMsg = "Network connection error. Please check your internet.";
      }

      setError(userFriendlyMsg);
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setIsAdmin(null);
      console.log(`[Auth] Admin logged out. Session cleared.`);
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, error, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
