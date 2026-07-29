export type CardType = "minion" | "spell";
export type Keyword = "none" | "taunt" | "charge" | "lifesteal";
export type Battlecry = "none" | "damage_enemy_hero";
export type Deathrattle = "none" | "draw_card";
export type SpellEffect =
  | "damage_enemy_hero"
  | "heal_hero"
  | "draw_two"
  | "damage_enemy_minion";

// Trigger soportado por el Event Bus del motor del juego (game.html).
// Ver arquitectura_habilidades_cartas.txt, Parte 2.
export type Trigger =
  | "ON_ENTER"
  | "ON_DEATH"
  | "ON_ATTACK"
  | "ON_DAMAGE_TAKEN"
  | "ON_HEAL"
  | "ON_TURN_START"
  | "ON_TURN_END"
  | "ON_SPELL_CAST"
  | "ON_FRIENDLY_DEATH"
  | "ON_ENEMY_ATTACK"
  | "ON_DRAW"
  | "ON_DAMAGE_DEALT";

// Effect que el motor sabe ejecutar hoy (abilitySystem.registerEffect en game.html).
export type Effect = "DEAL_DAMAGE" | "HEAL" | "DRAW_CARD" | "RETURN_TO_HAND" | "GIVE_CHARGE";

export interface Ability {
  trigger: Trigger;
  effect: Effect;
  params?: Record<string, unknown>;
}

// --- Catálogo del editor visual de habilidades ---
// Fuente única para el builder de CardForm.tsx: qué triggers y effects se
// pueden elegir, y qué parámetros pide cada effect. Si agregás un effect
// nuevo acá, también tenés que:
//   1. Implementar abilitySystem.registerEffect(...) en game/game.html
//   2. Sumarlo a VALID_EFFECTS en backend/app/schemas.py
// Los tres (acá, game.html, schemas.py) tienen que listar los mismos
// nombres de effect/trigger o una carta puede guardarse pero no hacer nada
// en el juego (o directamente el backend la rechaza).

export type SimpleTrigger = "ON_ENTER" | "ON_DEATH";

export const TRIGGER_OPTIONS: { value: SimpleTrigger; label: string }[] = [
  { value: "ON_ENTER", label: "Grito de guerra (al entrar al campo)" },
  { value: "ON_DEATH", label: "Estertor (al morir)" },
];

export type ParamFieldKind = "number" | "select";

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamField {
  key: string;
  label: string;
  kind: ParamFieldKind;
  min?: number;
  max?: number;
  default: number | string;
  options?: ParamOption[];
  // Si se define, el campo solo se muestra cuando el valor actual de otro
  // parámetro NO está en esta lista (ej: ocultar "cantidad" si el target
  // elegido ya implica "todos").
  hideWhenParam?: { key: string; oneOf: string[] };
}

export interface EffectDef {
  label: string;
  description: string;
  params: ParamField[];
}

export const EFFECT_CATALOG: Record<Effect, EffectDef> = {
  DEAL_DAMAGE: {
    label: "Hacer daño",
    description: "Le quita puntos de vida a un objetivo.",
    params: [
      { key: "amount", label: "Cantidad de daño", kind: "number", min: 1, max: 20, default: 1 },
      {
        key: "target",
        label: "Objetivo",
        kind: "select",
        default: "ENEMY_HERO",
        options: [
          { value: "ENEMY_HERO", label: "Héroe rival" },
          { value: "RANDOM_ENEMY_MINION", label: "Esbirro rival al azar" },
          { value: "ANY_ENEMY", label: "Cualquiera del rival (héroe o esbirro)" },
          { value: "CHOOSE_ENEMY_MINION", label: "Elegir esbirro rival" },
          { value: "CHOOSE_ANY_ENEMY", label: "Elegir del rival (héroe o esbirro)" },
        ],
      },
    ],
  },
  HEAL: {
    label: "Curar",
    description: "Restaura puntos de vida a un objetivo (sin superar su vida máxima).",
    params: [
      { key: "amount", label: "Puntos de vida", kind: "number", min: 1, max: 20, default: 2 },
      {
        key: "target",
        label: "Objetivo",
        kind: "select",
        default: "OWNER_HERO",
        options: [
          { value: "OWNER_HERO", label: "Tu héroe" },
          { value: "RANDOM_OWN_MINION", label: "Un esbirro tuyo al azar" },
          { value: "ANY_OWN", label: "Cualquiera tuyo (héroe o esbirro)" },
          { value: "CHOOSE_OWN_MINION", label: "Elegir esbirro tuyo" },
          { value: "CHOOSE_ANY_OWN", label: "Elegir tuyo (héroe o esbirro)" },
        ],
      },
    ],
  },
  DRAW_CARD: {
    label: "Robar cartas",
    description: "El dueño de la carta roba cartas de su mazo.",
    params: [
      { key: "amount", label: "Cantidad de cartas", kind: "number", min: 1, max: 5, default: 1 },
    ],
  },
  RETURN_TO_HAND: {
    label: "Devolver esbirros a la mano",
    description: "Saca esbirros del campo y los manda de vuelta a la mano de su dueño, con sus stats originales.",
    params: [
      {
        key: "target",
        label: "Objetivo",
        kind: "select",
        default: "ENEMY_MINIONS",
        options: [
          { value: "ENEMY_MINIONS", label: "Esbirros rivales al azar" },
          { value: "OWN_MINIONS", label: "Esbirros tuyos al azar" },
          { value: "ANY_MINIONS", label: "Cualquier esbirro al azar (de cualquier lado)" },
          { value: "ALL_MINIONS", label: "Todos los esbirros del campo" },
          { value: "CHOOSE_ENEMY_MINIONS", label: "Elegir esbirro(s) rival(es)" },
          { value: "CHOOSE_OWN_MINIONS", label: "Elegir esbirro(s) tuyo(s)" },
          { value: "CHOOSE_ANY_MINIONS", label: "Elegir esbirro(s) (de cualquier lado)" },
        ],
      },
      {
        key: "amount",
        label: "Cantidad de esbirros",
        kind: "number",
        min: 1,
        max: 7,
        default: 1,
        hideWhenParam: { key: "target", oneOf: ["ALL_MINIONS"] },
      },
    ],
  },
  GIVE_CHARGE: {
    label: "Dar Carga",
    description: "El esbirro puede atacar el mismo turno en que entra al campo.",
    params: [],
  },
};

// Arma una habilidad nueva con los valores por defecto de un effect dado.
export function defaultAbility(effect: Effect, trigger: SimpleTrigger = "ON_ENTER"): Ability {
  const params: Record<string, unknown> = {};
  EFFECT_CATALOG[effect].params.forEach((p) => {
    params[p.key] = p.default;
  });
  return { trigger, effect, params };
}

export interface CardData {
  id?: string;
  name: string;
  mana_cost: number;
  card_type: CardType;
  legendary: boolean;
  origin?: string;
  archetypes: string[];
  teams: string[];

  attack?: number | null;
  health?: number | null;
  keyword: Keyword;

  // Campos legacy: se mantienen por compatibilidad con cartas viejas y con
  // los checkboxes simples del formulario. El motor del juego los usa solo
  // como fallback cuando `abilities` viene vacío.
  battlecry: Battlecry;
  deathrattle: Deathrattle;

  // Sistema de habilidades declarativo (Event Bus). Ver arquitectura_
  // habilidades_cartas.txt. Ejemplo:
  //   [{ trigger: "ON_ENTER", effect: "DEAL_DAMAGE", params: { amount: 1, target: "ENEMY_HERO" } }]
  abilities: Ability[];

  spell_effect?: SpellEffect | null;
  spell_value?: number | null;

  image_url?: string | null;
  image_pos_x: number;
  image_pos_y: number;
  image_scale: number;
  flavor_text?: string | null;
}

export const emptyCard: CardData = {
  name: "",
  mana_cost: 1,
  card_type: "minion",
  legendary: false,
  origin: "",
  archetypes: [],
  teams: [],
  attack: 1,
  health: 1,
  keyword: "none",
  battlecry: "none",
  deathrattle: "none",
  abilities: [],
  spell_effect: null,
  spell_value: null,
  image_url: "",
  image_pos_x: 50,
  image_pos_y: 50,
  image_scale: 100,
  flavor_text: "",
};

// --- Catálogos administrables: Orígenes, Arquetipos, Equipos ---
// Son listas simples (solo nombre) que se gestionan aparte de las cartas,
// como "empleados" (cartas) vs. "áreas de trabajo" (estos catálogos).
// `icon` queda reservado para el futuro (ej. un ícono SVG o emoji por
// entrada); hoy no se usa en la UI, por eso es opcional.
export interface CatalogEntry {
  id: string;
  name: string;
  icon?: string | null;
}

// --- Auth ---
export interface User {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

// --- Colección y Mazos ---
export type DeckMode = "free" | "normal";

export interface DeckCardEntry {
  card_id: string;
  quantity: number;
  card: CardData;
}

export interface Deck {
  id: string;
  name: string;
  mode: DeckMode;
  created_at: string;
  updated_at: string;
  cards: DeckCardEntry[];
}

export interface DeckSummary {
  id: string;
  name: string;
  mode: DeckMode;
  created_at: string;
  updated_at: string;
  card_count: number;
}

export interface DeckCardInput {
  card_id: string;
  quantity: number;
}

export interface CollectionEntry {
  card_id: string;
  quantity: number;
  card: CardData;
}
