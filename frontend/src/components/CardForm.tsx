import { useState, useEffect, useRef } from "react";
import type { Ability, CardData, Effect, Keyword, SimpleTrigger, SpellEffect } from "../types";
import { EFFECT_CATALOG, TRIGGER_OPTIONS, defaultAbility } from "../types";
import { emptyCard } from "../types";
import { resolveImageUrl, getOrigins, getArchetypes, getAssociations } from "../api";

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

  const [jsonMode, setJsonMode] = useState(false);
  const [abilitiesText, setAbilitiesText] = useState(
    JSON.stringify(initialCard?.abilities ?? [], null, 2)
  );
  const [abilitiesError, setAbilitiesError] = useState<string | null>(null);

  // Estados para opciones de autocompletado
  const [originOptions, setOriginOptions] = useState<string[]>([]);
  const [archetypeOptions, setArchetypeOptions] = useState<string[]>([]);
  const [associationOptions, setAssociationOptions] = useState<string[]>([]);

  useEffect(() => {
    // Carga de listas al montar
    getOrigins().then(setOriginOptions);
    getArchetypes().then(setArchetypeOptions);
    getAssociations().then(setAssociationOptions);
  }, []);

  useEffect(() => {
    setCard(initialCard ?? emptyCard);
    setImageFile(null);
    setPreview(null);
    setAbilitiesText(JSON.stringify(initialCard?.abilities ?? [], null, 2));
    setAbilitiesError(null);
    setJsonMode(false);
  }, [initialCard]);

  function handleAbilitiesTextChange(text: string) {
    setAbilitiesText(text);
    try {
      const parsed = JSON.parse(text || "[]");
      if (!Array.isArray(parsed)) throw new Error("Debe ser un array");
      setAbilitiesError(null);
      update("abilities", parsed);
    } catch (err) {
      setAbilitiesError(err instanceof Error ? err.message : "JSON inválido");
    }
  }

  function switchToJsonMode() {
    setAbilitiesText(JSON.stringify(card.abilities, null, 2));
    setAbilitiesError(null);
    setJsonMode(true);
  }

  function switchToBuilderMode() {
    try {
      const parsed = JSON.parse(abilitiesText || "[]");
      if (!Array.isArray(parsed)) throw new Error("Debe ser un array");
      update("abilities", parsed);
      setAbilitiesError(null);
      setJsonMode(false);
    } catch (err) {
      setAbilitiesError(err instanceof Error ? err.message : "JSON inválido");
    }
  }

  function addAbility() {
    update("abilities", [...card.abilities, defaultAbility("DEAL_DAMAGE")]);
  }

  function updateAbility(index: number, next: Ability) {
    const copy = card.abilities.slice();
    copy[index] = next;
    update("abilities", copy);
  }

  function removeAbility(index: number) {
    update(
      "abilities",
      card.abilities.filter((_, i) => i !== index)
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function update<K extends keyof CardData>(key: K, value: CardData[K]) {
    setCard((prev) => ({ ...prev, [key]: value }));
  }

  function toggleKeyword(k: Keyword) {
    update("keyword", card.keyword === k ? "none" : k);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (abilitiesError) {
      setError(`El JSON de habilidades no es válido: ${abilitiesError}`);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(card, imageFile);
      if (!initialCard) {
        setCard(emptyCard);
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

          <label style={styles.label}>
            Origen (anime)
            <input
              style={styles.input}
              list="origin-options"
              value={card.origin ?? ""}
              onChange={(e) => update("origin", e.target.value)}
              placeholder="Elegí uno existente o escribí uno nuevo"
              maxLength={60}
            />
            <datalist id="origin-options">
              {originOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>

          <TagPicker
            label="Arquetipos"
            values={card.archetypes ?? []}
            onChange={(v) => update("archetypes", v)}
            max={2}
            placeholder="Ej: espadachin"
            options={archetypeOptions}
          />

          <TagPicker
            label="Asociaciones"
            values={card.associations ?? []}
            onChange={(v) => update("associations", v)}
            max={2}
            placeholder="Ej: mugiwaras"
            options={associationOptions}
          />

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

          <div style={styles.abilitiesHeader}>
            <span style={{ fontWeight: "bold" }}>Habilidades</span>
            <button
              type="button"
              onClick={jsonMode ? switchToBuilderMode : switchToJsonMode}
              style={styles.linkBtn}
            >
              {jsonMode ? "Volver al editor visual" : "Modo experto (JSON)"}
            </button>
          </div>

          {jsonMode ? (
            <label style={styles.label}>
              JSON de habilidades
              <textarea
                style={{ ...styles.input, height: 90, fontFamily: "monospace", fontSize: 12 }}
                value={abilitiesText}
                onChange={(e) => handleAbilitiesTextChange(e.target.value)}
                placeholder={'[{ "trigger": "ON_ENTER", "effect": "DEAL_DAMAGE", "params": { "amount": 1, "target": "ENEMY_HERO" } }]'}
              />
            </label>
          ) : (
            <AbilityEditor
              abilities={card.abilities}
              onAdd={addAbility}
              onChange={updateAbility}
              onRemove={removeAbility}
            />
          )}
          {abilitiesError && (
            <div style={styles.error}>JSON de habilidades inválido: {abilitiesError}</div>
          )}
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

/**
 * Componente TagPicker para Arquetipos y Asociaciones con Autocompletado
 */
function TagPicker({
  label, values, onChange, max, placeholder, options = [],
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  max: number;
  placeholder: string;
  options?: string[];
}) {
  const [draft, setDraft] = useState("");
  const listId = `${label}-datalist`.replace(/\s+/g, "-");

  function addTag(raw?: string) {
    const v = (raw ?? draft).trim().toLowerCase();
    if (!v || values.includes(v) || values.length >= max) return;
    onChange([...values, v]);
    setDraft("");
  }

  return (
    <div style={styles.fieldset}>
      <div style={{ fontWeight: "bold", marginBottom: 4, fontSize: 13 }}>
        {label} ({values.length}/{max})
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {values.map((v) => (
          <span key={v} style={styles.tag}>
            {v}
            <button 
              type="button" 
              style={styles.tagRemoveBtn}
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {values.length < max && (
        <>
          <input
            style={{ ...styles.input, width: "100%" }}
            list={listId}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTag(); }
            }}
            onBlur={() => addTag()}
          />
          <datalist id={listId}>
            {options.filter((o) => !values.includes(o)).map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </>
      )}
    </div>
  );
}

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

interface ImagePositionEditorProps {
  src: string;
  posX: number;
  posY: number;
  scale: number;
  onChange: (posX: number, posY: number) => void;
}

interface AbilityEditorProps {
  abilities: Ability[];
  onAdd: () => void;
  onChange: (index: number, next: Ability) => void;
  onRemove: (index: number) => void;
}

function AbilityEditor({ abilities, onAdd, onChange, onRemove }: AbilityEditorProps) {
  return (
    <div style={styles.abilitiesBox}>
      {abilities.length === 0 && (
        <span style={{ fontSize: 12, color: "#ccc" }}>Esta carta todavía no tiene habilidades.</span>
      )}
      {abilities.map((ability, index) => (
        <AbilityRow
          key={index}
          ability={ability}
          onChange={(next) => onChange(index, next)}
          onRemove={() => onRemove(index)}
        />
      ))}
      <button type="button" onClick={onAdd} style={styles.addAbilityBtn}>
        + Agregar habilidad
      </button>
    </div>
  );
}

interface AbilityRowProps {
  ability: Ability;
  onChange: (next: Ability) => void;
  onRemove: () => void;
}

function AbilityRow({ ability, onChange, onRemove }: AbilityRowProps) {
  const def = EFFECT_CATALOG[ability.effect];
  const params = ability.params ?? {};

  function setTrigger(trigger: SimpleTrigger) {
    onChange({ ...ability, trigger });
  }

  function setEffect(effect: Effect) {
    onChange(defaultAbility(effect, ability.trigger as SimpleTrigger));
  }

  function setParam(key: string, value: string | number) {
    onChange({ ...ability, params: { ...params, [key]: value } });
  }

  return (
    <div style={styles.abilityRow}>
      <div style={styles.abilityRowTop}>
        <select
          style={styles.input}
          value={ability.trigger}
          onChange={(e) => setTrigger(e.target.value as SimpleTrigger)}
        >
          {TRIGGER_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          style={styles.input}
          value={ability.effect}
          onChange={(e) => setEffect(e.target.value as Effect)}
        >
          {(Object.keys(EFFECT_CATALOG) as Effect[]).map((key) => (
            <option key={key} value={key}>
              {EFFECT_CATALOG[key].label}
            </option>
          ))}
        </select>

        <button type="button" onClick={onRemove} style={styles.removeAbilityBtn} title="Quitar habilidad">
          ✕
        </button>
      </div>

      <span style={{ fontSize: 11, color: "#ccc" }}>{def.description}</span>

      {def.params.length > 0 && (
        <div style={styles.row}>
          {def.params
            .filter((p) => {
              if (!p.hideWhenParam) return true;
              const otherValue = params[p.hideWhenParam.key];
              return !p.hideWhenParam.oneOf.includes(String(otherValue));
            })
            .map((p) => (
              <label key={p.key} style={styles.label}>
                {p.label}
                {p.kind === "number" ? (
                  <input
                    type="number"
                    style={styles.input}
                    min={p.min}
                    max={p.max}
                    value={Number(params[p.key] ?? p.default)}
                    onChange={(e) => setParam(p.key, Number(e.target.value))}
                  />
                ) : (
                  <select
                    style={styles.input}
                    value={String(params[p.key] ?? p.default)}
                    onChange={(e) => setParam(p.key, e.target.value)}
                  >
                    {p.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ))}
        </div>
      )}
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
    flexDirection: "column",
    gap: 8,
    padding: 10,
  },
  abilitiesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#f3d430",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 12,
    padding: 0,
  },
  abilitiesBox: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    border: "1px solid #c3a05b",
    borderRadius: 6,
    padding: 10,
    background: "#1c140d",
  },
  abilityRow: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    border: "1px solid #4a3a26",
    borderRadius: 6,
    padding: 8,
  },
  abilityRowTop: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  addAbilityBtn: {
    padding: "6px 12px",
    background: "#3a2f22",
    border: "1px solid #c3a05b",
    borderRadius: 5,
    color: "#f3d430",
    cursor: "pointer",
    alignSelf: "flex-start",
    fontSize: 13,
  },
  removeAbilityBtn: {
    background: "#5a1a1a",
    border: "none",
    borderRadius: 5,
    color: "#fff",
    cursor: "pointer",
    padding: "4px 10px",
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
  tag: {
    background: "#c3a05b",
    color: "#241a12",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  tagRemoveBtn: {
    background: "none",
    border: "none",
    color: "#241a12",
    cursor: "pointer",
    padding: 0,
    fontSize: 14,
    lineHeight: 1,
  }
};