import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [field, setField] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!field || !password) { setError("Completá todos los campos."); return; }
    setError(null);
    setLoading(true);
    try {
      await login(field, password);
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>Card Creator</h1>
        <h2 style={s.subtitle}>Iniciar sesión</h2>

        <input
          style={s.input}
          placeholder="Usuario o email"
          value={field}
          onChange={(e) => setField(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
        />
        <input
          style={s.input}
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        {error && <p style={s.error}>{error}</p>}

        <button style={s.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? "Ingresando..." : "Entrar"}
        </button>

        <p style={s.link}>
          ¿No tenés cuenta?{" "}
          <Link to="/register" style={s.anchor}>Registrarse</Link>
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle, #6b4a2e 0%, #2b1a0f 100%)",
  },
  card: {
    background: "#1e1510", border: "2px solid #c3a05b", borderRadius: "12px",
    padding: "48px 40px", display: "flex", flexDirection: "column", gap: "14px",
    width: "340px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
  },
  title: {
    margin: 0, color: "#f3d430", fontFamily: "Georgia, serif",
    fontSize: "1.8rem", textAlign: "center", letterSpacing: "2px",
  },
  subtitle: {
    margin: 0, color: "#c3a05b", fontFamily: "Georgia, serif",
    fontSize: "1rem", textAlign: "center", fontWeight: "normal",
  },
  input: {
    background: "#2c241e", border: "1px solid #6b4a2e", borderRadius: "6px",
    padding: "10px 14px", color: "#f3e8c0", fontSize: "0.95rem", outline: "none",
    fontFamily: "Georgia, serif",
  },
  btn: {
    background: "#3a2c1c", border: "2px solid #c3a05b", borderRadius: "6px",
    padding: "12px", color: "#f3d430", fontSize: "1rem", fontWeight: "bold",
    fontFamily: "Georgia, serif", cursor: "pointer", marginTop: "4px",
    transition: "filter 0.2s",
  },
  error: { color: "#e07070", margin: 0, fontSize: "0.85rem", textAlign: "center" },
  link: { color: "#aaa", fontSize: "0.85rem", textAlign: "center", margin: 0, fontFamily: "Georgia, serif" },
  anchor: { color: "#f3d430", textDecoration: "underline" },
};
