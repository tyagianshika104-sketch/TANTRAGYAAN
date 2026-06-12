import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, Profile } from "./api";

type AuthContextValue = {
  profile: Profile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    const nextProfile = await api.getProfile();
    setProfile(nextProfile);
    localStorage.setItem("ff-authenticated", "true");
  };

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    setProfile({ ...result.user, ...result.profile });
    localStorage.setItem("ff-authenticated", "true");
  };

  const signup = async (name: string, email: string, password: string) => {
    const result = await api.signup(name, email, password);
    setProfile({ ...result.user, ...result.profile });
    localStorage.setItem("ff-authenticated", "true");
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setProfile(null);
    localStorage.removeItem("ff-authenticated");
  };

  useEffect(() => {
    if (!localStorage.getItem("ff-authenticated")) {
      setIsLoading(false);
      return;
    }

    refreshProfile()
      .catch(() => localStorage.removeItem("ff-authenticated"))
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo(
    () => ({ profile, isLoading, login, signup, refreshProfile, logout }),
    [profile, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
