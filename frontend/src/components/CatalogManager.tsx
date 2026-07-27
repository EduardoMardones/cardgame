import { useEffect, useState } from "react";
import type { CatalogEntry } from "../types";

interface Props {
  title: string;
  placeholder: string;
  list: () => Promise<CatalogEntry[]>;
  create: (name: string) => Promise<CatalogEntry>;
  remove: (id: string) => Promise<void>;
}

/**
 * Sección genérica para administrar un catálogo simple (solo nombre):
 * Orígenes, Arquetipos o Equipos. Es lo mismo que crear "áreas de
 * trabajo" o "sucursales" aparte de los "empleados" (las cartas): estas
 * entradas existen por sí solas, las use o no una carta todavía.
 */
export default function CatalogManager({ title, placeholder, list, create, remove }: Props) {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setEntries(await list());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setError(null);
    setSaving(true);
    try {
      await create(name);
      setDraft("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await remove(id);
    await load();
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.heading}>{title}</h2>

      <form onSubmit={handleCreate} style={styles.form}>
        <input
          style={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          maxLength={60}
        />
        <button type="submit" disabled={saving} style={styles.addBtn}>
          {saving ? "Agregando..." : "+ Agregar"}
        </button>
      </form>

      {error && <div style={styles.error}>{error}</div>}

      {entries.length === 0 ? (
        <p style={{ color: "#aaa" }}>Todavía no hay nada acá.</p>
      ) : (
        <ul style={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id} style={styles.item}>
              <span>{entry.name}</span>
              <button
                type="button"
                style={styles.removeBtn}
                onClick={() => handleDelete(entry.id)}
                title="Borrar"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    background: "#241a12",
    padding: 20,
    borderRadius: 10,
    border: "2px solid #c3a05b",
    color: "#fff",
    maxWidth: 480,
    fontFamily: "Arial, sans-serif",
  },
  heading: { margin: "0 0 12px", color: "#f3d430" },
  form: { display: "flex", gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    padding: "6px 8px",
    borderRadius: 5,
    border: "1px solid #c3a05b",
    background: "#2c241e",
    color: "#fff",
  },
  addBtn: {
    padding: "6px 14px",
    background: "#2e7d32",
    border: "none",
    borderRadius: 5,
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  error: {
    background: "#5a1a1a",
    border: "1px solid #e61919",
    padding: 8,
    borderRadius: 5,
    fontSize: 12,
    marginBottom: 12,
  },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#2c241e",
    border: "1px solid #6b5730",
    borderRadius: 6,
    padding: "6px 10px",
  },
  removeBtn: {
    padding: "3px 10px",
    fontSize: 11,
    background: "#7a1f1f",
    border: "1px solid #c3a05b",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
  },
};
