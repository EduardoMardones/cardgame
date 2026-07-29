import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import type { CardData, CatalogEntry, DeckMode, CollectionEntry } from "../types";
import {
  fetchCards, listOrigins, listArchetypes, listTeams,
  fetchMyCollection, fetchDeck, createDeck, updateDeck, claimOrigin,
  resolveImageUrl,
} from "../api";
import ClaimOriginModal from "../components/ClaimOriginModal";

const MAX_DECK_SIZE = 30;
const MAX_COPIES = 2;

type DeckEntry = { card: CardData; quantity: number };

// Traduce keyword/battlecry/deathrattle/spell_effect a texto legible para
// el panel expandido, con el mismo criterio que el motor del juego.
function describeAbilityText(card: CardData): string | null {
  const parts: string[] = [];
  if (card.card_type === "spell" && card.spell_effect) {
    const labels: Record<string, string> = {
      damage_enemy_hero: "Hace daño al héroe rival",
      heal_hero: "Cura a tu héroe",
      draw_two: "Roba 2 cartas",
      damage_enemy_minion: "Hace daño a un esbirro rival",
    };
    parts.push(labels[card.spell_effect] ?? card.spell_effect);
  }
  if (card.battlecry && card.battlecry !== "none") {
    parts.push(card.battlecry === "damage_enemy_hero" ? "Grito de guerra: daño al héroe rival" : card.battlecry);
  }
  if (card.deathrattle && card.deathrattle !== "none") {
    parts.push(card.deathrattle === "draw_card" ? "Estertor: roba una carta" : card.deathrattle);
  }
  if (card.abilities && card.abilities.length > 0) {
    parts.push(`${card.abilities.length} habilidad(es) especial(es)`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default function DeckBuilderPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !deckId || deckId === "nuevo";

  const [mode, setMode] = useState<DeckMode>(
    (searchParams.get("mode") as DeckMode) || "free"
  );
  const [deckName, setDeckName] = useState("Mazo sin nombre");
  const [deckMap, setDeckMap] = useState<Map<string, DeckEntry>>(new Map());

  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [origins, setOrigins] = useState<CatalogEntry[]>([]);
  const [archetypes, setArchetypes] = useState<CatalogEntry[]>([]);
  const [teams, setTeams] = useState<CatalogEntry[]>([]);

  const [search, setSearch] = useState("");
  const [manaFilter, setManaFilter] = useState<number | null>(null);
  const [originFilter, setOriginFilter] = useState("");
  const [archetypeFilter, setArchetypeFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);

  // Carta actualmente "abierta" en la grilla (click izquierdo). Solo una
  // a la vez, igual que el hover del juego real.
  const [zoomedCardId, setZoomedCardId] = useState<string | null>(null);

  // Corrección de posición para que la carta agrandada no se salga de la
  // pantalla cuando está cerca de un borde (izquierdo/derecho/superior).
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cards, myCollection, o, a, t] = await Promise.all([
          fetchCards(),
          fetchMyCollection(),
          listOrigins(),
          listArchetypes(),
          listTeams(),
        ]);
        setAllCards(cards);
        setCollection(myCollection);
        setOrigins(o);
        setArchetypes(a);
        setTeams(t);

        if (!isNew && deckId) {
          const deck = await fetchDeck(deckId);
          setDeckName(deck.name);
          setMode(deck.mode);
          const map = new Map<string, DeckEntry>();
          deck.cards.forEach((dc) => map.set(dc.card_id, { card: dc.card, quantity: dc.quantity }));
          setDeckMap(map);
        } else if (mode === "normal" && myCollection.length === 0) {
          setShowClaimModal(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar el constructor");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // Al abrir (o cambiar) la carta zoomeada, reseteamos el offset y medimos
  // recién cuando la TRANSICIÓN CSS del transform terminó de verdad (la
  // tile tiene `transition: all 0.25s ease`, así que medir en el frame
  // siguiente al click captura una posición intermedia, no la final).
  useLayoutEffect(() => {
    setZoomOffset({ x: 0, y: 0 });
    if (!zoomedCardId) return;

    const el = tileRefs.current.get(zoomedCardId);
    if (!el) return;

    function measureAndCorrect() {
      const rect = el!.getBoundingClientRect();
      const margin = 16;
      let dx = 0;
      let dy = 0;
      if (rect.left < margin) dx = margin - rect.left;
      else if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right;
      if (rect.top < margin) dy = margin - rect.top;
      if (dx !== 0 || dy !== 0) setZoomOffset({ x: dx, y: dy });
    }

    el.addEventListener("transitionend", measureAndCorrect, { once: true });
    // Red de seguridad: si por lo que sea no llega a dispararse transitionend
    // (ej. el usuario ya tenía la carta agrandada y el transform no cambió),
    // medimos igual pasado el tiempo de la transición.
    const fallback = setTimeout(measureAndCorrect, 280);

    return () => {
      el.removeEventListener("transitionend", measureAndCorrect);
      clearTimeout(fallback);
    };
  }, [zoomedCardId]);

  const availablePool: { card: CardData; owned: number }[] = useMemo(() => {
    if (mode === "free") {
      return allCards.map((c) => ({ card: c, owned: Infinity }));
    }
    return collection.map((entry) => ({ card: entry.card, owned: entry.quantity }));
  }, [mode, allCards, collection]);

  const filteredPool = useMemo(() => {
    return availablePool.filter(({ card }) => {
      if (search && !card.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (manaFilter !== null && card.mana_cost !== manaFilter) return false;
      if (originFilter && card.origin !== originFilter) return false;
      if (archetypeFilter && !card.archetypes.includes(archetypeFilter)) return false;
      if (teamFilter && !card.teams.includes(teamFilter)) return false;
      return true;
    });
  }, [availablePool, search, manaFilter, originFilter, archetypeFilter, teamFilter]);

  const deckList = useMemo(
    () =>
      Array.from(deckMap.values()).sort((a, b) => a.card.mana_cost - b.card.mana_cost || a.card.name.localeCompare(b.card.name)),
    [deckMap]
  );
  const totalCards = deckList.reduce((sum, e) => sum + e.quantity, 0);

  function addCardToDeck(card: CardData, owned: number) {
    if (!card.id) return;
    setDeckMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(card.id!);
      const currentQty = existing?.quantity ?? 0;

      if (totalCards >= MAX_DECK_SIZE) {
        setError(`El mazo ya tiene ${MAX_DECK_SIZE} cartas.`);
        return prev;
      }
      if (currentQty >= MAX_COPIES) {
        setError("No podés tener más de 2 copias de la misma carta.");
        return prev;
      }
      if (mode === "normal" && currentQty >= owned) {
        setError("No tenés más copias de esa carta en tu colección.");
        return prev;
      }

      setError(null);
      next.set(card.id!, { card, quantity: currentQty + 1 });
      return next;
    });
  }

  function handleRemoveCard(cardId: string) {
    setDeckMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(cardId);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        next.delete(cardId);
      } else {
        next.set(cardId, { ...existing, quantity: existing.quantity - 1 });
      }
      return next;
    });
  }

  function handleClear() {
    if (deckMap.size > 0 && !confirm("¿Vaciar el mazo?")) return;
    setDeckMap(new Map());
  }

  async function handleSave() {
    if (!deckName.trim()) {
      setError("Ponele un nombre al mazo.");
      return;
    }
    setSaving(true);
    setError(null);
    const cardsPayload = deckList.map((e) => ({ card_id: e.card.id!, quantity: e.quantity }));
    try {
      if (isNew) {
        const created = await createDeck(deckName.trim(), mode, cardsPayload);
        navigate(`/mazos/${created.id}`, { replace: true });
      } else if (deckId) {
        await updateDeck(deckId, deckName.trim(), cardsPayload);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el mazo");
    } finally {
      setSaving(false);
    }
  }

  async function handleClaim(originId: string) {
    await claimOrigin(originId);
    const refreshed = await fetchMyCollection();
    setCollection(refreshed);
    setShowClaimModal(false);
  }

  if (loading) {
    return <div style={s.wrap}><p style={{ color: "#ccc" }}>Cargando...</p></div>;
  }

  return (
    <div style={s.wrap}>
      {showClaimModal && (
        <ClaimOriginModal
          origins={origins}
          onClaim={handleClaim}
          onClose={() => navigate("/mazos")}
        />
      )}

      <div style={s.topBar}>
        <Link to="/mazos" style={s.back}>← Mis mazos</Link>
        <input
          style={s.nameInput}
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          placeholder="Nombre del mazo"
        />
        <span style={s.modeTag}>{mode === "free" ? "Modo libre" : "Modo normal"}</span>
        <div style={{ flex: 1 }} />
        <span style={s.counter}>{totalCards} / {MAX_DECK_SIZE}</span>
        <button style={s.clearBtn} onClick={handleClear}>Limpiar</button>
        <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {error && <p style={s.errorBar}>{error}</p>}

      <div style={s.body}>
        {/* COLUMNA IZQUIERDA: catálogo disponible */}
        <div style={s.leftCol}>
          <div style={s.filters}>
            <input
              style={s.search}
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select style={s.select} value={originFilter} onChange={(e) => setOriginFilter(e.target.value)}>
              <option value="">Todos los orígenes</option>
              {origins.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
            </select>
            <select style={s.select} value={archetypeFilter} onChange={(e) => setArchetypeFilter(e.target.value)}>
              <option value="">Todos los arquetipos</option>
              {archetypes.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
            <select style={s.select} value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="">Todos los equipos</option>
              {teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
            <select
              style={s.select}
              value={manaFilter ?? ""}
              onChange={(e) => setManaFilter(e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">Cualquier maná</option>
              {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                <option key={n} value={n}>{n} de maná</option>
              ))}
            </select>
          </div>

          {mode === "normal" && collection.length === 0 && (
            <p style={{ color: "#aaa", fontSize: 13 }}>
              Todavía no reclamaste ningún origen.{" "}
              <button style={s.linkBtn} onClick={() => setShowClaimModal(true)}>Elegir set inicial</button>
            </p>
          )}

          <p style={s.hint}>Click izquierdo: ver detalle de la carta · Click derecho: agregar al mazo</p>

          <div style={s.grid}>
            {filteredPool.map(({ card, owned }) => {
              const inDeckQty = card.id ? deckMap.get(card.id)?.quantity ?? 0 : 0;
              const isZoomed = card.id === zoomedCardId;
              const abilityText = describeAbilityText(card);
              const chips = [
                ...(card.origin ? [{ label: card.origin, kind: "origin" as const }] : []),
                ...card.archetypes.map((a) => ({ label: a, kind: "normal" as const })),
                ...(card.keyword !== "none" ? [{ label: card.keyword, kind: "normal" as const }] : []),
              ];

              return (
                <div key={card.id} style={s.tileSlot}>
                  <div
                    ref={(el) => {
                      if (card.id) {
                        if (el) tileRefs.current.set(card.id, el);
                        else tileRefs.current.delete(card.id);
                      }
                    }}
                    style={{
                      ...s.tile,
                      ...(isZoomed
                        ? {
                            ...s.tileZoomed,
                            transform: `translate(${zoomOffset.x}px, ${-110 + zoomOffset.y}px) scale(2.38)`,
                          }
                        : {}),
                    }}
                    onClick={() => setZoomedCardId((prev) => (prev === card.id ? null : card.id ?? null))}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      addCardToDeck(card, owned);
                    }}
                    title="Click: detalle · Click derecho: agregar"
                  >
                    <div style={s.mana}>{card.mana_cost}</div>
                    {inDeckQty > 0 && <div style={s.inDeckBadge}>x{inDeckQty}</div>}
                    <strong style={{ ...s.tileName, color: card.legendary ? "#ffcc00" : "#f3d430" }}>
                      {card.name}
                    </strong>
                    <div style={s.imageBox}>
                      {resolveImageUrl(card.image_url) ? (
                        <img
                          src={resolveImageUrl(card.image_url)}
                          alt={card.name}
                          style={{
                            ...s.image,
                            objectPosition: `${card.image_pos_x}% ${card.image_pos_y}%`,
                            transform: `scale(${card.image_scale / 100})`,
                            transformOrigin: `${card.image_pos_x}% ${card.image_pos_y}%`,
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 10, color: "#777" }}>Sin imagen</span>
                      )}
                    </div>
                    {card.card_type === "minion" && (
                      <div style={{ fontSize: 11 }}>⚔ {card.attack} &nbsp; ❤ {card.health}</div>
                    )}
                    {mode === "normal" && owned !== Infinity && (
                      <span style={s.ownedTag}>x{owned} en colección</span>
                    )}

                    {/* Panel expandido: misma estética que .expanded-panel de game.css */}
                    {isZoomed && (
                      <div style={s.expandedPanel} onClick={(e) => e.stopPropagation()}>
                        <div style={s.expName}>{card.name}</div>
                        {abilityText && <div style={s.expAbility}>{abilityText}</div>}
                        {chips.length > 0 && (
                          <div style={s.expChips}>
                            {chips.map((c, i) => (
                              <span key={i} style={{ ...s.chip, ...(c.kind === "origin" ? s.chipOrigin : {}) }}>
                                {c.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {card.flavor_text && <div style={s.expFlavor}>{card.flavor_text}</div>}
                        <button
                          style={s.expAddBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            addCardToDeck(card, owned);
                          }}
                        >
                          + Agregar al mazo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredPool.length === 0 && (
              <p style={{ color: "#777", fontSize: 13 }}>Ninguna carta disponible con estos filtros.</p>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: mazo actual */}
        <div style={s.rightCol}>
          <h3 style={s.rightTitle}>Mazo actual</h3>
          {deckList.length === 0 && <p style={{ color: "#777", fontSize: 13 }}>Todavía no agregaste cartas.</p>}
          <div style={s.deckList}>
            {deckList.map(({ card, quantity }) => (
              <div key={card.id} style={s.deckRow} onClick={() => handleRemoveCard(card.id!)} title="Click para quitar">
                <span style={s.deckMana}>{card.mana_cost}</span>
                <span style={s.deckCardName}>{card.name}</span>
                <span style={s.deckQty}>x{quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Colores tomados 1:1 de las variables CSS de game.css (--border-gold, etc.)
const BORDER_GOLD = "#c3a05b";

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#171310", fontFamily: "Georgia, serif", color: "#fff" },
  topBar: {
    display: "flex", alignItems: "center", gap: 14, padding: "14px 24px",
    borderBottom: "1px solid #6b5730", flexWrap: "wrap",
  },
  back: { color: "#c3a05b", textDecoration: "none" },
  nameInput: {
    background: "#2c241e", border: "1px solid #6b5730", borderRadius: 6,
    padding: "8px 12px", color: "#f3d430", fontSize: 15, fontFamily: "Georgia, serif", minWidth: 220,
  },
  modeTag: { fontSize: 12, color: "#c3a05b", border: "1px solid #6b5730", borderRadius: 12, padding: "3px 10px" },
  counter: { fontSize: 13, color: "#ccc" },
  clearBtn: {
    background: "transparent", border: "1px solid #7a1f1f", borderRadius: 6,
    padding: "8px 14px", color: "#e07070", cursor: "pointer",
  },
  saveBtn: {
    background: "#3a2c1c", border: "2px solid #c3a05b", borderRadius: 6,
    padding: "8px 20px", color: "#f3d430", fontWeight: "bold", cursor: "pointer",
  },
  errorBar: { color: "#e07070", background: "#2a1414", padding: "8px 24px", margin: 0, fontSize: 13 },
  body: { display: "flex", gap: 20, padding: 20 },
  leftCol: { flex: 3, minWidth: 0 },
  rightCol: {
    flex: 1, minWidth: 260, background: "#1c1712", border: "1px solid #6b5730",
    borderRadius: 8, padding: 14, alignSelf: "flex-start", position: "sticky", top: 20,
  },
  rightTitle: { margin: "0 0 10px", color: "#f3d430", fontSize: 15 },
  filters: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  hint: { fontSize: 11, color: "#8a7757", marginBottom: 14 },
  search: {
    background: "#2c241e", border: "1px solid #6b5730", borderRadius: 6,
    padding: "7px 10px", color: "#fff", fontSize: 13, flex: 1, minWidth: 160,
  },
  select: {
    background: "#2c241e", border: "1px solid #6b5730", borderRadius: 6,
    padding: "7px 10px", color: "#fff", fontSize: 13,
  },
  linkBtn: { background: "none", border: "none", color: "#f3d430", textDecoration: "underline", cursor: "pointer", padding: 0 },

  // El grid necesita overflow visible y espacio arriba/abajo para que la
  // carta pueda "levantarse" y mostrar el panel sin recortarse.
  grid: {
    display: "flex", flexWrap: "wrap", gap: 10, overflow: "visible",
    paddingTop: 130, paddingBottom: 40,
  },
  tileSlot: { position: "relative", width: 120, height: 190 },

  tile: {
    background: "#2c241e", border: "3px solid " + BORDER_GOLD, borderRadius: 10,
    padding: 8, width: 120, cursor: "pointer", position: "absolute", top: 0, left: 0,
    transition: "all 0.25s ease", transformOrigin: "bottom center", zIndex: 1,
  },
  // Réplica de `.card:hover` en game.css: sube y escala 2.38x.
  // El `transform` real (con la corrección de borde) se arma inline en el JSX.
  tileZoomed: {
    zIndex: 1000,
    boxShadow: "0 14px 34px rgba(0,0,0,0.8)",
  },
  tileName: { fontSize: 12, display: "block" },
  mana: {
    position: "absolute", top: -8, left: -8, width: 22, height: 22, borderRadius: "50%",
    background: "#00a2ff", display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: "bold", fontSize: 12, border: "1px solid #fff", zIndex: 5,
  },
  inDeckBadge: {
    position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%",
    background: "#2e7d32", display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: "bold", fontSize: 11, border: "1px solid #fff", color: "#fff", zIndex: 5,
  },
  imageBox: {
    width: "100%", height: 70, margin: "6px 0", borderRadius: 6, overflow: "hidden",
    background: "#1a1510", border: "1px solid #6b5730", display: "flex",
    alignItems: "center", justifyContent: "center",
  },
  image: { width: "100%", height: "100%", objectFit: "cover" },
  ownedTag: { fontSize: 10, color: "#8fbf7a", display: "block", marginTop: 4 },

  deckList: { display: "flex", flexDirection: "column", gap: 4, maxHeight: "70vh", overflowY: "auto" },
  deckRow: {
    display: "flex", alignItems: "center", gap: 8, background: "#2c241e",
    border: "1px solid #6b5730", borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 13,
  },
  deckMana: {
    width: 20, height: 20, borderRadius: "50%", background: "#00a2ff",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold", flexShrink: 0,
  },
  deckCardName: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  deckQty: { color: "#c3a05b", fontSize: 12 },

  // --- Panel expandido: clon 1:1 de .expanded-panel / .exp-* de game.css ---
  expandedPanel: {
    position: "absolute", left: "50%", bottom: -8, transform: "translate(-50%, 100%) scale(0.588)",
    width: 170, background: "linear-gradient(180deg, #241a10, #150e08)",
    border: "2px solid " + BORDER_GOLD, borderRadius: 8, padding: "8px 10px 10px",
    boxShadow: "0 10px 22px rgba(0,0,0,0.6)", fontSize: 10, transformOrigin: "top center",
    zIndex: 1001, cursor: "default",
  },
  expName: { fontSize: 11, fontWeight: "bold", color: "#f3d430", textAlign: "center", marginBottom: 6, textShadow: "0 1px 2px #000" },
  expAbility: { color: "#f1e6c8", lineHeight: 1.3, marginBottom: 6, textAlign: "center" },
  expChips: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6, justifyContent: "center" },
  chip: {
    fontSize: 8.5, padding: "2px 6px", borderRadius: 20, border: "1px solid " + BORDER_GOLD,
    background: "rgba(195,160,91,0.12)", color: "#f3d430", whiteSpace: "nowrap",
  },
  chipOrigin: { borderColor: "#7ea8c4", color: "#bfe0f0", background: "rgba(126,168,196,0.12)" },
  expFlavor: {
    fontStyle: "italic", color: "#b9a988", fontSize: 8.5, lineHeight: 1.25,
    borderTop: "1px dashed rgba(195,160,91,0.3)", paddingTop: 5, marginBottom: 6,
  },
  expAddBtn: {
    width: "100%", background: "#3a2c1c", border: "1px solid " + BORDER_GOLD, borderRadius: 6,
    padding: "5px 0", color: "#f3d430", fontSize: 9, fontWeight: "bold", cursor: "pointer",
  },
};
