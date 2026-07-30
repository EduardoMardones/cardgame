import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function GamePage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { token } = useAuth();

  const src = deckId
    ? `/game/game.html?deckId=${deckId}&token=${encodeURIComponent(token ?? "")}`
    : `/game/game.html`;

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <Link to="/" style={backButtonStyle}>← Menú</Link>
      <iframe
        src={src}
        style={{ border: "none", width: "100%", height: "100%", display: "block" }}
        title="Juego de cartas"
      />
    </div>
  );
}

const backButtonStyle: React.CSSProperties = {
  position: "absolute", top: 12, left: 12, zIndex: 1000,
  padding: "6px 14px", background: "rgba(0,0,0,0.55)", color: "#f3d430",
  border: "1px solid #c3a05b", borderRadius: "6px", textDecoration: "none",
  fontSize: "13px", fontFamily: "Georgia, serif",
};
