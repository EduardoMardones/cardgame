import { useState, useEffect, useRef } from "react";
import type { CardData, Keyword, SpellEffect } from "../types";
import { emptyCard } from "../types";
import { resolveImageUrl } from "../api";

interface Props {
  initialCard?: CardData;
  onSubmit: (card: CardData, imageFile?: File | null) => Promise<void>;
  onCancel?: () => void;
}

export default function CardForm({ initialCard, onSubmit, onCancel }: Props) {
  const [card, setCard] = useState<CardData>(initialCard ?? emptyCard);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    setCard(initialCard ?? emptyCard);
    setImageFile(null);
    setPreview(null);
  }, [initialCard]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function update<K extends keyof CardData>(key: K, value: CardData[K]) {
    setCard((prev) => ({ ...prev, [key]: value }));
  }

  // Los checks de palabra clave son mutuamente excluyentes en este juego
  // (un esbirro tiene una palabra clave a la vez): se muestran como checkboxes
  // pero internamente se guardan como un único valor "keyword".
  function toggleKeyword(k: Keyword) {
    update("keyword", card.keyword === k ? "none" : k);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(card, imageFile);
      if (!initialCard) {
        setCard(emptyCard); // limpia el form solo si es una carta nueva
        setImageFile(null);
        setPreview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  const isMinion = card.card_type === "minion";

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.heading}>{initialCard ? "Editar carta" : "Nueva carta"}</h2>

      {error && <div style={styles.error}>{error}</div>}

      <label style={styles.label}>
        Nombre
        <input
          style={styles.input}
          value={card.name}
          onChange={(e) => update("name", e.target.value)}
          required
          maxLength={60}
        />
      </label>

      <div style={styles.row}>
        <label style={styles.label}>
          Coste de maná
          <input
            type="number"
            style={styles.input}
            min={0}
            max={20}
            value={card.mana_cost}
            onChange={(e) => update("mana_cost", Number(e.target.value))}
            required
          />
        </label>

        <label style={styles.label}>
          Tipo de carta
          <select
            style={styles.input}
            value={card.card_type}
            onChange={(e) => update("card_type", e.target.value as CardData["card_type"])}
          >
            <option value="minion">Esbirro</option>
            <option value="spell">Hechizo</option>
          </select>
        </label>

        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={card.legendary}
            onChange={(e) => update("legendary", e.target.checked)}
          />
          Legendaria
        </label>
      </div>

      {isMinion ? (
        <>
          <div style={styles.row}>
            <label style={styles.label}>
              Ataque
              <input
                type="number"
                style={styles.input}
                min={0}
                max={20}
                value={card.attack ?? 0}
                onChange={(e) => update("attack", Number(e.target.value))}
                required
              />
            </label>
            <label style={styles.label}>
              Vida
              <input
                type="number"
                style={styles.input}
                min={1}
                max={20}
                value={card.health ?? 1}
                onChange={(e) => update("health", Number(e.target.value))}
                required
              />
            </label>
          </div>

          <fieldset style={styles.fieldset}>
            <legend>Palabra clave</legend>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={card.keyword === "taunt"}
                onChange={() => toggleKeyword("taunt")}
              />
              Provocar
            </label>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={card.keyword === "charge"}
                onChange={() => toggleKeyword("charge")}
              />
              Carga
            </label>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={card.keyword === "lifesteal"}
                onChange={() => toggleKeyword("lifesteal")}
              />
              Vida robada
            </label>
          </fieldset>

          <div style={styles.row}>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={card.battlecry === "damage_enemy_hero"}
                onChange={(e) =>
                  update("battlecry", e.target.checked ? "damage_enemy_hero" : "none")
                }
              />
              Grito de guerra: 1 daño al héroe rival
            </label>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={card.deathrattle === "draw_card"}
                onChange={(e) =>
                  update("deathrattle", e.target.checked ? "draw_card" : "none")
                }
              />
              Estertor: roba una carta
            </label>
          </div>
        </>
      ) : (
        <>
          <label style={styles.label}>
            Efecto del hechizo
            <select
              style={styles.input}
              value={card.spell_effect ?? "damage_enemy_hero"}
              onChange={(e) => update("spell_effect", e.target.value as SpellEffect)}
            >
              <option value="damage_enemy_hero">Daño al héroe rival</option>
              <option value="heal_hero">Curar a tu héroe</option>
              <option value="draw_two">Robar 2 cartas</option>
              <option value="damage_enemy_minion">Daño a un esbirro rival al azar</option>
            </select>
          </label>

          {card.spell_effect !== "draw_two" && (
            <label style={styles.label}>
              Valor del efecto (daño o curación)
              <input
                type="number"
                style={styles.input}
                min={0}
                max={20}
                value={card.spell_value ?? 0}
                onChange={(e) => update("spell_value", Number(e.target.value))}
              />
            </label>
          )}
        </>
      )}

      <label style={styles.label}>
        Imagen de la carta (opcional)
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={styles.input}
          onChange={handleFileChange}
        />
      </label>

      {(preview || resolveImageUrl(card.image_url)) && (
        <>
          <span style={{ fontSize: 12, color: "#ccc" }}>
            Arrastrá la imagen para ubicarla dentro del cuadro
          </span>
          <ImagePositionEditor
            src={preview ?? resolveImageUrl(card.image_url)!}
            posX={card.image_pos_x}
            posY={card.image_pos_y}
            scale={card.image_scale}
            onChange={(posX, posY) => {
              update("image_pos_x", posX);
              update("image_pos_y", posY);
            }}
          />
          <label style={styles.label}>
            Zoom
            <input
              type="range"
              min={100}
              max={300}
              value={card.image_scale}
              onChange={(e) => update("image_scale", Number(e.target.value))}
            />
          </label>
        </>
      )}

      <label style={styles.label}>
        Texto de sabor (opcional)
        <textarea
          style={{ ...styles.input, height: 60 }}
          value={card.flavor_text ?? ""}
          onChange={(e) => update("flavor_text", e.target.value)}
          maxLength={200}
        />
      </label>

      <div style={styles.actions}>
        <button type="submit" disabled={saving} style={styles.submitBtn}>
          {saving ? "Guardando..." : initialCard ? "Guardar cambios" : "Crear carta"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} style={styles.cancelBtn}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

interface ImagePositionEditorProps {
  src: string;
  posX: number;
  posY: number;
  scale: number;
  onChange: (posX: number, posY: number) => void;
}

// Cuadro donde se ve la imagen recortada como quedaría en la carta.
// Arrastrando con el mouse (o el dedo) se cambia qué parte de la imagen queda visible.
function ImagePositionEditor({ src, posX, posY, scale, onChange }: ImagePositionEditorProps) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const dragging = useRef({ active: false, lastX: 0, lastY: 0 }).current;

  function clamp(v: number) {
    return Math.round(Math.min(100, Math.max(0, v)));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.active = true;
    dragging.lastX = e.clientX;
    dragging.lastY = e.clientY;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.active || !box) return;
    const dx = e.clientX - dragging.lastX;
    const dy = e.clientY - dragging.lastY;
    dragging.lastX = e.clientX;
    dragging.lastY = e.clientY;

    const rect = box.getBoundingClientRect();
    // Arrastrar hacia la derecha muestra más de la parte izquierda de la imagen,
    // por eso restamos el delta en vez de sumarlo.
    const newX = clamp(posX - (dx / rect.width) * 100);
    const newY = clamp(posY - (dy / rect.height) * 100);
    onChange(newX, newY);
  }

  function handlePointerUp() {
    dragging.active = false;
  }

  return (
    <div
      ref={setBox}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        width: "100%",
        height: 140,
        borderRadius: 6,
        border: "1px solid #c3a05b",
        overflow: "hidden",
        cursor: "grab",
        touchAction: "none",
        background: "#111",
      }}
    >
      <img
        src={src}
        alt="Editor de posición"
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${posX}% ${posY}%`,
          transform: `scale(${scale / 100})`,
          transformOrigin: `${posX}% ${posY}%`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "#241a12",
    padding: 20,
    borderRadius: 10,
    border: "2px solid #c3a05b",
    color: "#fff",
    maxWidth: 480,
    fontFamily: "Arial, sans-serif",
  },
  heading: { margin: 0, color: "#f3d430" },
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, flex: 1 },
  checkLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13 },
  input: {
    padding: "6px 8px",
    borderRadius: 5,
    border: "1px solid #c3a05b",
    background: "#2c241e",
    color: "#fff",
  },
  fieldset: {
    border: "1px solid #c3a05b",
    borderRadius: 6,
    display: "flex",
    gap: 16,
    padding: 10,
  },
  actions: { display: "flex", gap: 10, marginTop: 8 },
  submitBtn: {
    padding: "8px 16px",
    background: "#2e7d32",
    border: "none",
    borderRadius: 5,
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
  cancelBtn: {
    padding: "8px 16px",
    background: "#555",
    border: "none",
    borderRadius: 5,
    color: "#fff",
    cursor: "pointer",
  },
  error: {
    background: "#5a1a1a",
    border: "1px solid #e61919",
    padding: 8,
    borderRadius: 5,
    fontSize: 12,
  },
};
