import { useEffect, useState } from "react";
import type { CardData } from "./types";
import { fetchCards, createCard, updateCard, deleteCard, uploadCardImage } from "./api";
import CardForm from "./components/CardForm";
import CardList from "./components/CardList";

export default function App() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [editing, setEditing] = useState<CardData | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    try {
      setCards(await fetchCards());
      setLoadError(null);
    } catch (e) {
      setLoadError("No se pudo conectar con el backend (¿está corriendo en :8000?)");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(card: CardData, imageFile?: File | null) {
    let saved: CardData;
    if (editing?.id) {
      saved = await updateCard(editing.id, card);
      setEditing(undefined);
    } else {
      saved = await createCard(card);
    }
    // La imagen se sube en un segundo paso porque necesitamos el id de la carta ya creada
    if (imageFile && saved.id) {
      await uploadCardImage(saved.id, imageFile);
    }
    await load();
  }

  async function handleDelete(id: string) {
    await deleteCard(id);
    await load();
  }

  return (
    <div style={{ background: "#111", minHeight: "100vh", padding: 24, fontFamily: "Arial" }}>
      <h1 style={{ color: "#f3d430" }}>Creador de cartas</h1>
      {loadError && <p style={{ color: "#e61919" }}>{loadError}</p>}

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        <CardForm
          initialCard={editing}
          onSubmit={handleSubmit}
          onCancel={editing ? () => setEditing(undefined) : undefined}
        />

        <div style={{ flex: 1, minWidth: 300 }}>
          <h2 style={{ color: "#fff" }}>Cartas creadas ({cards.length})</h2>
          <CardList cards={cards} onEdit={setEditing} onDelete={handleDelete} />
        </div>
      </div>
    </div>
  );
}
