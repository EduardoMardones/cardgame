import type { CatalogEntry } from "../types";

export type SortField = "none" | "mana_cost" | "attack" | "health";
export type SortDir = "asc" | "desc";

interface Props {
  origins: CatalogEntry[];
  archetypes: CatalogEntry[];
  teams: CatalogEntry[];

  originFilter: string;
  archetypeFilter: string;
  teamFilter: string;
  cardTypeFilter: "all" | "minion" | "spell";

  sortBy: SortField;
  sortDir: SortDir;

  onOriginChange: (v: string) => void;
  onArchetypeChange: (v: string) => void;
  onTeamChange: (v: string) => void;
  onCardTypeChange: (v: "all" | "minion" | "spell") => void;
  onSortByChange: (v: SortField) => void;
  onSortDirChange: (v: SortDir) => void;
  onReset: () => void;

  resultCount: number;
  totalCount: number;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "none", label: "Sin ordenar" },
  { value: "mana_cost", label: "Coste de maná" },
  { value: "attack", label: "Ataque" },
  { value: "health", label: "Vida" },
];

/**
 * Barra de filtros/orden para la lista de cartas creadas. Es puramente
 * controlada: no guarda estado propio, solo dispara los callbacks para
 * que EditorPage decida cómo filtrar/ordenar el array de cartas.
 */
export default function CardFilters({
  origins, archetypes, teams,
  originFilter, archetypeFilter, teamFilter, cardTypeFilter,
  sortBy, sortDir,
  onOriginChange, onArchetypeChange, onTeamChange, onCardTypeChange,
  onSortByChange, onSortDirChange, onReset,
  resultCount, totalCount,
}: Props) {
  const hasActiveFilters =
    !!originFilter || !!archetypeFilter || !!teamFilter || cardTypeFilter !== "all" || sortBy !== "none";

  return (
    <div style={styles.bar}>
      <div style={styles.group}>
        <label style={styles.label}>Origen</label>
        <select style={styles.select} value={originFilter} onChange={(e) => onOriginChange(e.target.value)}>
          <option value="">Todos</option>
          {origins.map((o) => (
            <option key={o.id} value={o.name}>{o.name}</option>
          ))}
        </select>
      </div>

      <div style={styles.group}>
        <label style={styles.label}>Arquetipo</label>
        <select style={styles.select} value={archetypeFilter} onChange={(e) => onArchetypeChange(e.target.value)}>
          <option value="">Todos</option>
          {archetypes.map((a) => (
            <option key={a.id} value={a.name}>{a.name}</option>
          ))}
        </select>
      </div>

      <div style={styles.group}>
        <label style={styles.label}>Equipo</label>
        <select style={styles.select} value={teamFilter} onChange={(e) => onTeamChange(e.target.value)}>
          <option value="">Todos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      <div style={styles.group}>
        <label style={styles.label}>Tipo</label>
        <select
          style={styles.select}
          value={cardTypeFilter}
          onChange={(e) => onCardTypeChange(e.target.value as "all" | "minion" | "spell")}
        >
          <option value="all">Todos</option>
          <option value="minion">Esbirro</option>
          <option value="spell">Hechizo</option>
        </select>
      </div>

      <div style={styles.group}>
        <label style={styles.label}>Ordenar por</label>
        <select style={styles.select} value={sortBy} onChange={(e) => onSortByChange(e.target.value as SortField)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {sortBy !== "none" && (
        <div style={styles.group}>
          <label style={styles.label}>&nbsp;</label>
          <button
            type="button"
            style={styles.dirBtn}
            onClick={() => onSortDirChange(sortDir === "asc" ? "desc" : "asc")}
            title={sortDir === "asc" ? "Ascendente" : "Descendente"}
          >
            {sortDir === "asc" ? "↑ Menor a mayor" : "↓ Mayor a menor"}
          </button>
        </div>
      )}

      <div style={styles.countAndReset}>
        <span style={styles.count}>{resultCount} / {totalCount} carta(s)</span>
        {hasActiveFilters && (
          <button type="button" style={styles.resetBtn} onClick={onReset}>
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 14,
    marginBottom: 16,
    padding: "10px 12px",
    background: "#1c1712",
    border: "1px solid #6b5730",
    borderRadius: 8,
  },
  group: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 11, color: "#c3a05b", fontFamily: "Georgia, serif" },
  select: {
    background: "#2c241e",
    color: "#fff",
    border: "1px solid #6b5730",
    borderRadius: 6,
    padding: "5px 8px",
    fontSize: 13,
    minWidth: 120,
  },
  dirBtn: {
    background: "#2c241e",
    color: "#f3d430",
    border: "1px solid #c3a05b",
    borderRadius: 6,
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  countAndReset: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  count: { fontSize: 12, color: "#aaa" },
  resetBtn: {
    background: "transparent",
    color: "#e61919",
    border: "1px solid #7a1f1f",
    borderRadius: 6,
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
};
