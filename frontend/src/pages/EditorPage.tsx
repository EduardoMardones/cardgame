import { useEffect, useState } from "react";
import type { CardData } from "../types";
import {
  fetchCards, createCard, updateCard, deleteCard, uploadCardImage,
  listOrigins, createOrigin, deleteOrigin,
  listArchetypes, createArchetype, deleteArchetype,
  listTeams, createTeam, deleteTeam,
} from "../api";
import CardForm from "../components/CardForm";
import CardList from "../components/CardList";
import CatalogManager from "../components/CatalogManager";
import { Link } from "react-router-dom";

type Tab = "cards" | "origins" | "archetypes" | "teams";

const TABS: { key: Tab; label: string }[] = [
  { key: "cards", label: "Cartas" },
  { key: "origins", label: "Orígenes" },
  { key: "archetypes", label: "Arquetipos" },
  { key: "teams", label: "Equipos" },
];

export default function EditorPage() {
  const [tab, setTab] = useState<Tab>("cards");
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
    // CAMBIO 1: le agrego position: "relative" al div que ya tenías,
    // para que el botón "← Menú" (que va con position: fixed) tenga
    // una referencia clara y no flote en cualquier lado.
    <div style={{ background: "#111", minHeight: "100vh", padding: 24, fontFamily: "Arial", position: "relative" }}>
      {/* CAMBIO 2: agrego el Link, esta es la única línea nueva de JSX */}
      <Link to="/" style={backButtonStyle}>← Menú</Link>

      <h1 style={{ color: "#f3d430" }}>Creador de cartas</h1>

      <nav style={tabsBarStyle}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...tabButtonStyle, ...(tab === t.key ? tabButtonActiveStyle : {}) }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "cards" && (
        <>
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
        </>
      )}

      {tab === "origins" && (
        <CatalogManager
          title="Orígenes"
          placeholder="Ej: One Piece"
          list={listOrigins}
          create={createOrigin}
          remove={deleteOrigin}
        />
      )}

      {tab === "archetypes" && (
        <CatalogManager
          title="Arquetipos"
          placeholder="Ej: espadachin"
          list={listArchetypes}
          create={createArchetype}
          remove={deleteArchetype}
        />
      )}

      {tab === "teams" && (
        <CatalogManager
          title="Equipos"
          placeholder="Ej: mugiwaras"
          list={listTeams}
          create={createTeam}
          remove={deleteTeam}
        />
      )}
    </div>
  );
}

// CAMBIO 3: este objeto de estilos va AFUERA del componente,
// después del cierre de la función (o antes, no importa el orden
// mientras esté fuera de EditorPage). Es solo una constante más
// en el archivo, como cualquier otra.
const backButtonStyle: React.CSSProperties = {
  position: "fixed", top: 12, left: 12, zIndex: 1000,
  padding: "6px 14px", background: "#2c241e", color: "#f3d430",
  border: "1px solid #c3a05b", borderRadius: "6px", textDecoration: "none",
  fontSize: "13px", fontFamily: "Georgia, serif",
};

const tabsBarStyle: React.CSSProperties = {
  display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap",
};

const tabButtonStyle: React.CSSProperties = {
  padding: "8px 18px", background: "#2c241e", color: "#ccc",
  border: "1px solid #6b5730", borderRadius: "6px", cursor: "pointer",
  fontSize: "14px", fontFamily: "Georgia, serif",
};

const tabButtonActiveStyle: React.CSSProperties = {
  background: "#3a2c1c", color: "#f3d430", borderColor: "#c3a05b",
  boxShadow: "0 0 10px rgba(243,212,48,0.25)",
};
