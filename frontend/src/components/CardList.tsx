import type { CardData } from "../types";
import { resolveImageUrl } from "../api";

interface Props {
  cards: CardData[];
  onEdit: (card: CardData) => void;
  onDelete: (id: string) => void;
}

export default function CardList({ cards, onEdit, onDelete }: Props) {
  if (cards.length === 0) {
    return <p style={{ color: "#aaa" }}>Todavía no creaste ninguna carta.</p>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {cards.map((card) => (
        <div key={card.id} style={styles.card}>
          <div style={styles.mana}>{card.mana_cost}</div>
          <strong style={{ color: card.legendary ? "#ffcc00" : "#fff" }}>{card.name}</strong>

          <div style={styles.imageBox}>
            {resolveImageUrl(card.image_url) ? (
              <img
                src={resolveImageUrl(card.image_url)}
                alt={card.name}
                style={{
                  ...styles.image,
                  objectPosition: `${card.image_pos_x}% ${card.image_pos_y}%`,
                  transform: `scale(${card.image_scale / 100})`,
                  transformOrigin: `${card.image_pos_x}% ${card.image_pos_y}%`,
                }}
              />
            ) : (
              <span style={{ fontSize: 11, color: "#777" }}>Sin imagen</span>
            )}
          </div>

          <div style={{ fontSize: 12, color: "#ccc" }}>
            {card.card_type === "minion" ? "Esbirro" : "Hechizo"}
            {card.keyword !== "none" && ` · ${card.keyword}`}
          </div>
          {card.card_type === "minion" && (
            <div style={{ fontSize: 13 }}>
              ⚔ {card.attack} &nbsp; ❤ {card.health}
            </div>
          )}
          <div style={styles.actions}>
            <button style={styles.btn} onClick={() => onEdit(card)}>Editar</button>
            <button
              style={{ ...styles.btn, background: "#7a1f1f" }}
              onClick={() => card.id && onDelete(card.id)}
            >
              Borrar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#2c241e",
    border: "2px solid #c3a05b",
    borderRadius: 8,
    padding: 10,
    width: 150,
    position: "relative",
    color: "#fff",
  },
  mana: {
    position: "absolute",
    top: -8,
    left: -8,
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "#00a2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    border: "1px solid #fff",
  },
  imageBox: {
    width: "100%",
    height: 90,
    margin: "6px 0",
    borderRadius: 6,
    overflow: "hidden",
    background: "#1a1510",
    border: "1px solid #6b5730",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%", objectFit: "cover" },
  actions: { display: "flex", gap: 6, marginTop: 8 },
  btn: {
    flex: 1,
    padding: "4px 6px",
    fontSize: 11,
    background: "#444",
    border: "1px solid #c3a05b",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
  },
};
