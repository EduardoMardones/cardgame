import type { CardData, CatalogEntry } from "./types";

const BASE_URL = "http://localhost:8000";

export async function fetchCards(): Promise<CardData[]> {
  const res = await fetch(`${BASE_URL}/cards/`);
  if (!res.ok) throw new Error("Error al cargar cartas");
  return res.json();
}

export async function createCard(card: CardData): Promise<CardData> {
  const res = await fetch(`${BASE_URL}/cards/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ? JSON.stringify(err.detail) : "Error al crear carta");
  }
  return res.json();
}

export async function updateCard(id: string, card: CardData): Promise<CardData> {
  const res = await fetch(`${BASE_URL}/cards/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error("Error al actualizar carta");
  return res.json();
}

export async function uploadCardImage(id: string, file: File): Promise<CardData> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/cards/${id}/image`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ? JSON.stringify(err.detail) : "Error al subir la imagen");
  }
  return res.json();
}

// Convierte una ruta relativa (ej: /static/uploads/x.png) en una URL absoluta al backend
export function resolveImageUrl(imageUrl?: string | null): string | undefined {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${BASE_URL}${imageUrl}`;
}

export async function deleteCard(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/cards/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Error al borrar carta");
}

// --- Catálogos administrables: Orígenes, Arquetipos, Equipos ---
// `kind` selecciona el sub-recurso de /catalog/*. Un solo set de helpers
// genéricos evita triplicar las mismas 3 funciones (listar/crear/borrar)
// para cada catálogo, ya que los tres tienen la misma forma (id + name).
type CatalogKind = "origins" | "archetypes" | "teams";

async function listCatalog(kind: CatalogKind): Promise<CatalogEntry[]> {
  const res = await fetch(`${BASE_URL}/catalog/${kind}`);
  if (!res.ok) return [];
  return res.json();
}

async function createCatalogEntry(kind: CatalogKind, name: string): Promise<CatalogEntry> {
  const res = await fetch(`${BASE_URL}/catalog/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ? String(err.detail) : "Error al crear el registro");
  }
  return res.json();
}

async function deleteCatalogEntry(kind: CatalogKind, id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/catalog/${kind}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Error al borrar el registro");
}

export const listOrigins = () => listCatalog("origins");
export const createOrigin = (name: string) => createCatalogEntry("origins", name);
export const deleteOrigin = (id: string) => deleteCatalogEntry("origins", id);

export const listArchetypes = () => listCatalog("archetypes");
export const createArchetype = (name: string) => createCatalogEntry("archetypes", name);
export const deleteArchetype = (id: string) => deleteCatalogEntry("archetypes", id);

export const listTeams = () => listCatalog("teams");
export const createTeam = (name: string) => createCatalogEntry("teams", name);
export const deleteTeam = (id: string) => deleteCatalogEntry("teams", id);

// Helpers de solo-nombre para los datalist/autocompletado del CardForm,
// que solo necesitan la lista de strings, no los ids.
export async function getOrigins(): Promise<string[]> {
  return (await listOrigins()).map((e) => e.name);
}

export async function getArchetypes(): Promise<string[]> {
  return (await listArchetypes()).map((e) => e.name);
}

export async function getTeams(): Promise<string[]> {
  return (await listTeams()).map((e) => e.name);
}
