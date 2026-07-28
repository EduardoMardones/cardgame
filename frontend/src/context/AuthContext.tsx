import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User, Token } from "../types";

const BASE_URL = "http://localhost:8000";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  // Al montar, si hay token en localStorage, verificamos que sigue siendo válido
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Token inválido");
        return res.json() as Promise<User>;
      })
      .then((u) => setUser(u))
      .catch(() => {
        // Token expirado o inválido → limpiamos
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);  // solo al montar

  async function login(usernameOrEmail: string, password: string) {
    // El backend espera form-urlencoded (OAuth2PasswordRequestForm)
    const body = new URLSearchParams();
    body.append("username", usernameOrEmail);
    body.append("password", password);

    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { detail?: string }).detail ?? "Error al iniciar sesión");
    }

    const data = (await res.json()) as Token;
    localStorage.setItem("token", data.access_token);
    setToken(data.access_token);

    // Traemos los datos del usuario inmediatamente
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const me = (await meRes.json()) as User;
    setUser(me);
  }

  async function register(username: string, email: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = (err as { detail?: unknown }).detail;
      const msg = Array.isArray(detail)
        ? (detail as { msg: string }[]).map((d) => d.msg).join(", ")
        : typeof detail === "string"
        ? detail
        : "Error al registrarse";
      throw new Error(msg);    }

    // Registro exitoso → logueamos automáticamente
    await login(username, password);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
