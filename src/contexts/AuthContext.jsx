import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, tokenStorage, userStorage, setUnauthorizedHandler } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Restore session from localStorage, then revalidate the token against the
  // server so an expired/tampered JWT is cleared immediately instead of
  // surviving until the first API call happens to 401.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedToken = tokenStorage.get();
      const savedUser = userStorage.get();
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(savedUser);
        try {
          const { data } = await api.get("/auth/me");
          if (cancelled) return;
          userStorage.set(data.user);
          setUser(data.user);
        } catch (err) {
          if (cancelled) return;
          // Only an explicit rejection clears the session; a network blip
          // keeps the cached token so a briefly-down API never logs people out.
          if (err.response?.status === 401 || err.response?.status === 403) {
            tokenStorage.clear();
            userStorage.clear();
            setToken(null);
            setUser(null);
          }
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Global 401 handler -> logout
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
  }, [navigate]);

  async function login(email, password) {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      tokenStorage.set(data.token);
      userStorage.set(data.user);
      setToken(data.token);
      setUser(data.user);
      return { success: true, data };
    } catch (err) {
      const message = err.response?.data?.message || "Login failed";
      setError(message);
      return { success: false, message };
    }
  }

  async function register(email, password, displayName) {
    setError("");
    try {
      const { data } = await api.post("/auth/register", { email, password, displayName });
      tokenStorage.set(data.token);
      userStorage.set(data.user);
      setToken(data.token);
      setUser(data.user);
      return { success: true, data };
    } catch (err) {
      const message = err.response?.data?.message || "Registration failed";
      setError(message);
      return { success: false, message };
    }
  }

  /**
   * Google returned from /auth/google/callback with a token in the URL hash.
   * Store it, then load the account the same way a password login would, so
   * the rest of the app cannot tell the two apart.
   */
  async function completeGoogleLogin(returnedToken) {
    setError("");
    try {
      tokenStorage.set(returnedToken);
      setToken(returnedToken);
      const { data } = await api.get("/auth/me");
      userStorage.set(data.user);
      setUser(data.user);
      return { success: true, data };
    } catch (err) {
      tokenStorage.clear();
      setToken(null);
      const message = err.response?.data?.message || "Google sign-in failed";
      setError(message);
      return { success: false, message };
    }
  }

  function logout() {
    tokenStorage.clear();
    userStorage.clear();
    setToken(null);
    setUser(null);
    navigate("/login");
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      error,
      isAuthenticated: !!user,
      login,
      register,
      completeGoogleLogin,
      logout,
      setError,
    }),
    [user, token, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export default AuthContext;