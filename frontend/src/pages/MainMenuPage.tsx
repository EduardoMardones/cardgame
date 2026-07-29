import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import OpenPackModal from "../components/OpenPackModal";

export default function MainMenuPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [showPackModal, setShowPackModal] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const packs = user?.packs_available ?? 0;

  return (
    <div style={styles.wrap}>
      <div style={styles.topBar}>
        <span style={styles.welcome}>👋 {user?.username ?? "Invitado"}</span>
        <button style={styles.logoutBtn} onClick={handleLogout}>Cerrar sesión</button>
      </div>

      <h1 style={styles.title}>Card Creator</h1>
      <p style={styles.subtitle}>Tu juego de cartas personalizado</p>

      {packs > 0 && (
        <button style={styles.packBtn} onClick={() => setShowPackModal(true)}>
          🎁 Abrir sobre ({packs} disponible{packs > 1 ? "s" : ""})
        </button>
      )}

      <div style={styles.buttons}>
        <Link to="/editor" style={styles.button}>Crear cartas</Link>
        <Link to="/juego" style={{ ...styles.button, ...styles.buttonPrimary }}>Jugar</Link>
        <Link to="/mazos" style={styles.button}>Mis mazos</Link>
      </div>

      {showPackModal && (
        <OpenPackModal
          onClose={() => setShowPackModal(false)}
          onOpened={refreshUser}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: "8px",
    background: "radial-gradient(circle, #6b4a2e 0%, #2b1a0f 100%)",
    color: "#f3d430", fontFamily: "Georgia, serif", textAlign: "center",
    position: "relative",
  },
  topBar: {
    position: "absolute", top: "20px", right: "24px",
    display: "flex", alignItems: "center", gap: "14px",
  },
  welcome: { color: "#f3e8c0", fontSize: "0.9rem" },
  logoutBtn: {
    background: "transparent", border: "1px solid #6b4a2e", borderRadius: "6px",
    padding: "6px 14px", color: "#c3a05b", cursor: "pointer", fontSize: "0.85rem",
    fontFamily: "Georgia, serif",
  },
  title: { fontSize: "3rem", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.6)", letterSpacing: "2px" },
  subtitle: { color: "#ddd", marginBottom: "16px", fontSize: "1rem" },
  packBtn: {
    marginBottom: "24px", padding: "10px 20px", border: "2px solid #f3d430", borderRadius: "8px",
    background: "#3a2c1c", color: "#f3d430", fontWeight: "bold", cursor: "pointer",
    boxShadow: "0 0 12px rgba(243,212,48,0.4)", fontFamily: "Georgia, serif",
  },
  buttons: { display: "flex", gap: "24px" },
  button: {
    padding: "16px 36px", border: "3px solid #c3a05b", borderRadius: "8px",
    background: "#2c241e", color: "#f3d430", textDecoration: "none",
    fontSize: "1.1rem", fontWeight: "bold", transition: "filter 0.2s",
  },
  buttonPrimary: { background: "#3a2c1c", boxShadow: "0 0 16px rgba(243,212,48,0.3)" },
};
