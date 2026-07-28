import enum
import uuid

from sqlalchemy import Column, String, Integer, Boolean, Enum, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID

from .database import Base


class CardType(str, enum.Enum):
    minion = "minion"
    spell = "spell"


class Keyword(str, enum.Enum):
    none = "none"
    taunt = "taunt"
    charge = "charge"
    lifesteal = "lifesteal"


# --- Campos "legacy" ---
# Se mantienen por compatibilidad con cartas ya creadas y con el formulario
# simple del frontend (checkboxes). El motor del juego (game.html) ya NO
# los usa como fuente de verdad: los convierte a `abilities` al vuelo si
# `abilities` viene vacío (ver `legacyToAbilities()` en game.html).
# Para cartas nuevas, lo recomendado es escribir directamente `abilities`.
class Battlecry(str, enum.Enum):
    none = "none"
    damage_enemy_hero = "damage_enemy_hero"


class Deathrattle(str, enum.Enum):
    none = "none"
    draw_card = "draw_card"


class SpellEffect(str, enum.Enum):
    damage_enemy_hero = "damage_enemy_hero"
    heal_hero = "heal_hero"
    draw_two = "draw_two"
    damage_enemy_minion = "damage_enemy_minion"


class Card(Base):
    __tablename__ = "cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    mana_cost = Column(Integer, nullable=False)
    card_type = Column(Enum(CardType), nullable=False, default=CardType.minion)
    legendary = Column(Boolean, default=False)

    # --- Identidad temática (solo para esbirros/personajes) ---
    origin = Column(String, nullable=True)                 # ej: "One Piece"
    archetypes = Column(JSONB, nullable=False, default=list, server_default="[]")     # ej: ["espadachin"]
    teams = Column(JSONB, nullable=False, default=list, server_default="[]")          # ej: ["mugiwaras"]

    # Solo aplica a esbirros (nullable para hechizos)
    attack = Column(Integer, nullable=True)
    health = Column(Integer, nullable=True)
    keyword = Column(Enum(Keyword), default=Keyword.none)

    # Campos legacy (ver comentario arriba). Se mantienen para no romper
    # cartas viejas ni el formulario simple del CardForm.
    battlecry = Column(Enum(Battlecry), default=Battlecry.none)
    deathrattle = Column(Enum(Deathrattle), default=Deathrattle.none)

    # --- Sistema de habilidades declarativo (Event Bus) ---
    # Lista de objetos { trigger, effect, params } tal como se describe en
    # arquitectura_habilidades_cartas.txt. Ejemplo:
    #   [
    #     {"trigger": "ON_ENTER", "effect": "DEAL_DAMAGE",
    #      "params": {"amount": 1, "target": "ENEMY_HERO"}},
    #     {"trigger": "ON_DEATH", "effect": "DRAW_CARD",
    #      "params": {"amount": 1, "player": "OWNER"}}
    #   ]
    # Si queda vacío, el frontend reconstruye una lista equivalente a partir
    # de battlecry/deathrattle (compatibilidad con cartas viejas).
    abilities = Column(JSONB, nullable=False, default=list, server_default="[]")

    # Solo aplica a hechizos (nullable para esbirros)
    spell_effect = Column(Enum(SpellEffect), nullable=True)
    spell_value = Column(Integer, nullable=True)

    image_url = Column(String, nullable=True)
    image_pos_x = Column(Integer, default=50)  # 0-100, % horizontal del recorte
    image_pos_y = Column(Integer, default=50)  # 0-100, % vertical del recorte
    image_scale = Column(Integer, default=100)  # 100 = sin zoom, 300 = 3x
    flavor_text = Column(String, nullable=True)


# --- Catálogos administrables ---
# Origen, Arquetipo y Equipo (ex "Asociación") son catálogos propios,
# independientes de las cartas: se pueden crear/borrar aunque todavía
# ninguna carta los use, igual que "áreas de trabajo" existen aparte de
# los "empleados" que las usan. Las cartas siguen guardando estos valores
# como texto plano (`origin`, `archetypes`, `teams`), y estas tablas solo
# alimentan las listas de opciones del editor.
#
# `icon` queda nullable a propósito: hoy no se usa en la UI, es un campo
# reservado por si en el futuro se le agrega un ícono a cada entrada.

class Origin(Base):
    __tablename__ = "origins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    icon = Column(String, nullable=True)


class Archetype(Base):
    __tablename__ = "archetypes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    icon = Column(String, nullable=True)


class Team(Base):
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    icon = Column(String, nullable=True)

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, nullable=False, unique=True)
    email = Column(String, nullable=False, unique=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    packs_available = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
