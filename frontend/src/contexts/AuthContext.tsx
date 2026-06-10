import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "../types/api";
import { authService } from "../services/auth";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem("auth_token"));

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      authService
        .getMe()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          // Token invalid or expired
          localStorage.removeItem("auth_token");
          setUser(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem("auth_token", token);
    setUser(userData);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
