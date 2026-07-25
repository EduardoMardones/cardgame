import { Link } from "react-router-dom";

export default function MainMenuPage() {
  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Card Creator</h1>
      <p style={styles.subtitle}>Tu juego de cartas personalizado</p>
      <div style={styles.buttons}>
        <Link to="/editor" style={styles.button}>Crear cartas</Link>
        <Link to="/juego" style={{ ...styles.button, ...styles.buttonPrimary }}>Jugar</Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: "8px",
    background: "radial-gradient(circle, #6b4a2e 0%, #2b1a0f 100%)",
    color: "#f3d430", fontFamily: "Georgia, serif", textAlign: "center",
  },
  title: { fontSize: "3rem", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.6)", letterSpacing: "2px" },
  subtitle: { color: "#ddd", marginBottom: "40px", fontSize: "1rem" },
  buttons: { display: "flex", gap: "24px" },
  button: {
    padding: "16px 36px", border: "3px solid #c3a05b", borderRadius: "8px",
    background: "#2c241e", color: "#f3d430", textDecoration: "none",
    fontSize: "1.1rem", fontWeight: "bold", transition: "filter 0.2s",
  },
  buttonPrimary: { background: "#3a2c1c", boxShadow: "0 0 16px rgba(243,212,48,0.3)" },
};