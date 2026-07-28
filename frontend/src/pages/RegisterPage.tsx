import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!username || !email || !password || !password2) {
      setError("Completá todos los campos."); return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden."); return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(username, email, password);
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>Card Creator</h1>
        <h2 style={s.subtitle}>Crear cuenta</h2>

        <input style={s.input} placeholder="Nombre de usuario" value={username}
          onChange={(e) => setUsername(e.target.value)} autoFocus />
        <input style={s.input} type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <input style={s.input} type="password" placeholder="Contraseña" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        <input style={s.input} type="password" placeholder="Repetir contraseña" value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />

        {error && <p style={s.error}>{error}</p>}

        <button style={s.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? "Creando cuenta..." : "Registrarse"}
        </button>

        <p style={s.link}>
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" style={s.anchor}>Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}

// Reutiliza exactamente los mismos estilos que LoginPage
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
  },
  error: { color: "#e07070", margin: 0, fontSize: "0.85rem", textAlign: "center" },
  link: { color: "#aaa", fontSize: "0.85rem", textAlign: "center", margin: 0, fontFamily: "Georgia, serif" },
  anchor: { color: "#f3d430", textDecoration: "underline" },
};
