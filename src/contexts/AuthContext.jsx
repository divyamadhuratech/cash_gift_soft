import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthContext } from "./auth-context";

import { useNavigate } from "react-router-dom";

import {
  api,
  tokenStorage,
  userStorage,
  setUnauthorizedHandler,
} from "@/lib/api";

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  // 1. Authentication states
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 2. Logout
  const logout = useCallback(() => {
    tokenStorage.clear();
    userStorage.clear();

    setToken(null);
    setUser(null);
    setError("");

    navigate("/login");
  }, [navigate]);

  // 3. Login
  const login = useCallback(async (email, password) => {
    setError("");

    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
      });

      tokenStorage.set(data.token);
      userStorage.set(data.user);

      setToken(data.token);
      setUser(data.user);

      return { success: true, data };
    } catch (err) {
      const message =
        err.response?.data?.message || "Login failed";

      setError(message);

      return { success: false, message };
    }
  }, []);

  // 4. Register
  const register = useCallback(
    async (email, password, displayName) => {
      setError("");

      try {
        const { data } = await api.post("/auth/register", {
          email,
          password,
          displayName,
        });

        tokenStorage.set(data.token);
        userStorage.set(data.user);

        setToken(data.token);
        setUser(data.user);

        return { success: true, data };
      } catch (err) {
        const message =
          err.response?.data?.message || "Registration failed";

        setError(message);

        return { success: false, message };
      }
    },
    []
  );

  // 5. Google login
  const completeGoogleLogin = useCallback(async (returnedToken) => {
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
      userStorage.clear();

      setToken(null);
      setUser(null);

      const message =
        err.response?.data?.message || "Google sign-in failed";

      setError(message);

      return { success: false, message };
    }
  }, []);

  // 6. Restore existing session
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const savedToken = tokenStorage.get();
        const savedUser = userStorage.get();

        if (!savedToken) {
          return;
        }

        // Restore cached session information
        if (savedUser) {
          setUser(savedUser);
        }

        setToken(savedToken);

        // Verify token with backend
        const { data } = await api.get("/auth/me");

        if (cancelled) return;

        userStorage.set(data.user);
        setUser(data.user);
      } catch (err) {
        if (cancelled) return;

        // Clear session if token is invalid
        if (
          err.response?.status === 401 ||
          err.response?.status === 403
        ) {
          tokenStorage.clear();
          userStorage.clear();

          setToken(null);
          setUser(null);
        }

        console.error("Session restoration failed:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // 7. Global unauthorized handler
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
  }, [logout]);

  // 8. Context value
  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      error,
      isAuthenticated: Boolean(user),

      login,
      register,
      completeGoogleLogin,
      logout,
      setError,
    }),
    [
      user,
      token,
      loading,
      error,
      login,
      register,
      completeGoogleLogin,
      logout,
    ]
  );

  // 9. Provider
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
