export type CardType = "minion" | "spell";
export type Keyword = "none" | "taunt" | "charge" | "lifesteal";
export type Battlecry = "none" | "damage_enemy_hero";
export type Deathrattle = "none" | "draw_card";
export type SpellEffect =
  | "damage_enemy_hero"
  | "heal_hero"
  | "draw_two"
  | "damage_enemy_minion";

export interface CardData {
  id?: string;
  name: string;
  mana_cost: number;
  card_type: CardType;
  legendary: boolean;

  attack?: number | null;
  health?: number | null;
  keyword: Keyword;
  battlecry: Battlecry;
  deathrattle: Deathrattle;

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
  attack: 1,
  health: 1,
  keyword: "none",
  battlecry: "none",
  deathrattle: "none",
  spell_effect: null,
  spell_value: null,
  image_url: "",
  image_pos_x: 50,
  image_pos_y: 50,
  image_scale: 100,
  flavor_text: "",
};
