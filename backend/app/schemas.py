import uuid
from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, model_validator

from .models import CardType, Keyword, Battlecry, Deathrattle, SpellEffect, DeckMode


# Lista finita de triggers soportada por el Event Bus del frontend
# (ver arquitectura_habilidades_cartas.txt, Parte 2). Se valida acá también
# para no guardar en la base cartas con triggers que el motor no reconoce.
VALID_TRIGGERS = {
    "ON_ENTER", "ON_DEATH", "ON_ATTACK", "ON_DAMAGE_TAKEN", "ON_HEAL",
    "ON_TURN_START", "ON_TURN_END", "ON_SPELL_CAST", "ON_FRIENDLY_DEATH",
    "ON_ENEMY_ATTACK", "ON_DRAW", "ON_DAMAGE_DEALT",
}

# Efectos que el motor del juego (game.html) sabe ejecutar hoy. Si agregás
# un handler nuevo con abilitySystem.registerEffect(...) en game.html,
# sumalo acá también para poder guardarlo desde el editor de cartas.
VALID_EFFECTS = {"DEAL_DAMAGE", "HEAL", "DRAW_CARD", "RETURN_TO_HAND", "GIVE_CHARGE"}


class Ability(BaseModel):
    trigger: str
    effect: str
    params: dict = Field(default_factory=dict)

    @field_validator("trigger")
    @classmethod
    def check_trigger(cls, v):
        if v not in VALID_TRIGGERS:
            raise ValueError(f"Trigger desconocido: {v}")
        return v

    @field_validator("effect")
    @classmethod
    def check_effect(cls, v):
        if v not in VALID_EFFECTS:
            raise ValueError(f"Effect desconocido: {v}")
        return v


class CardBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    mana_cost: int = Field(..., ge=0, le=20)
    card_type: CardType = CardType.minion
    legendary: bool = False

    origin: Optional[str] = Field(default=None, max_length=60)
    archetypes: list[str] = Field(default_factory=list, max_length=2)
    teams: list[str] = Field(default_factory=list, max_length=2)

    attack: Optional[int] = Field(default=None, ge=0, le=20)
    health: Optional[int] = Field(default=None, ge=1, le=20)
    keyword: Keyword = Keyword.none

    # Campos legacy: se mantienen por compatibilidad con el formulario
    # simple y con cartas ya creadas. El motor del juego los usa solo como
    # fallback cuando `abilities` viene vacío.
    battlecry: Battlecry = Battlecry.none
    deathrattle: Deathrattle = Deathrattle.none

    # Sistema de habilidades declarativo (Event Bus). Ver Ability arriba.
    abilities: list[Ability] = Field(default_factory=list)

    spell_effect: Optional[SpellEffect] = None
    spell_value: Optional[int] = Field(default=None, ge=0, le=20)

    image_url: Optional[str] = None
    image_pos_x: int = Field(default=50, ge=0, le=100)
    image_pos_y: int = Field(default=50, ge=0, le=100)
    image_scale: int = Field(default=100, ge=100, le=300)
    flavor_text: Optional[str] = Field(default=None, max_length=200)

    # El editor de posición en el frontend puede mandar valores con decimales
    # (ej. al arrastrar la imagen); los redondeamos en vez de rechazarlos.
    @field_validator("image_pos_x", "image_pos_y", "image_scale", mode="before")
    @classmethod
    def round_image_numbers(cls, v):
        if isinstance(v, float):
            return round(v)
        return v

    @model_validator(mode="after")
    def validate_by_type(self):
        if self.card_type == CardType.minion:
            if self.attack is None or self.health is None:
                raise ValueError("Los esbirros necesitan 'attack' y 'health'.")
        if self.card_type == CardType.spell:
            if self.spell_effect is None:
                raise ValueError("Los hechizos necesitan 'spell_effect'.")
            if self.origin or self.archetypes or self.teams:
                raise ValueError("Los hechizos no llevan origen/arquetipo/equipo.")
        return self


class CardCreate(CardBase):
    pass


class CardUpdate(CardBase):
    pass


class CardOut(CardBase):
    id: uuid.UUID

    class Config:
        from_attributes = True


# --- Catálogos administrables: Orígenes, Arquetipos, Equipos ---
# Listas simples (solo nombre) que se gestionan aparte de las cartas.
# `icon` va nullable/opcional a propósito: reservado para el futuro,
# hoy el frontend no lo pide.
class CatalogEntryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    icon: Optional[str] = Field(default=None, max_length=200)


class CatalogEntryCreate(CatalogEntryBase):
    pass


class CatalogEntryOut(CatalogEntryBase):
    id: uuid.UUID

    class Config:
        from_attributes = True


class OriginCreate(CatalogEntryCreate):
    pass


class OriginOut(CatalogEntryOut):
    pass


class ArchetypeCreate(CatalogEntryCreate):
    pass


class ArchetypeOut(CatalogEntryOut):
    pass


class TeamCreate(CatalogEntryCreate):
    pass


class TeamOut(CatalogEntryOut):
    pass

# --- Auth y Usuarios ---

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=6)


class UserOut(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    is_admin: bool
    packs_available: int

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None

# --- Colección ---

class CollectionEntry(BaseModel):
    card_id: uuid.UUID
    quantity: int
    card: CardOut

    class Config:
        from_attributes = True


class ClaimOriginRequest(BaseModel):
    origin_id: uuid.UUID


class OpenPackResult(BaseModel):
    cards: list[CardOut]
    packs_remaining: int

class DeckCardOut(BaseModel):
    card_id: uuid.UUID
    quantity: int
    card: CardOut

    class Config:
        from_attributes = True


class DeckOut(BaseModel):
    id: uuid.UUID
    name: str
    mode: DeckMode
    created_at: datetime
    updated_at: datetime
    cards: list[DeckCardOut] = []

    class Config:
        from_attributes = True


class DeckOutSummary(BaseModel):
    """Para listar mazos sin cargar todas las cartas."""
    id: uuid.UUID
    name: str
    mode: DeckMode
    created_at: datetime
    updated_at: datetime
    card_count: int = 0

    class Config:
        from_attributes = True


class DeckCardInput(BaseModel):
    card_id: uuid.UUID
    quantity: int = Field(..., ge=1, le=2)


class DeckCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    mode: DeckMode = DeckMode.free
    cards: list[DeckCardInput] = Field(default_factory=list)


class DeckUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    cards: list[DeckCardInput] = Field(default_factory=list)

# --- Resultado de partida vs IA ---

class GameResultRequest(BaseModel):
    deck_id: uuid.UUID
    result: Literal["win", "lose"]


class GameResultResponse(BaseModel):
    packs_available: int
    pack_awarded: bool
