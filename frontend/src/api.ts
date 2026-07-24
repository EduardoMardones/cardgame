import type { CardData } from "./types";

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
