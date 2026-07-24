import enum
import uuid

from sqlalchemy import Column, String, Integer, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID

from .database import Base


class CardType(str, enum.Enum):
    minion = "minion"
    spell = "spell"


class Keyword(str, enum.Enum):
    none = "none"
    taunt = "taunt"
    charge = "charge"
    lifesteal = "lifesteal"


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

    # Solo aplica a esbirros (nullable para hechizos)
    attack = Column(Integer, nullable=True)
    health = Column(Integer, nullable=True)
    keyword = Column(Enum(Keyword), default=Keyword.none)
    battlecry = Column(Enum(Battlecry), default=Battlecry.none)
    deathrattle = Column(Enum(Deathrattle), default=Deathrattle.none)

    # Solo aplica a hechizos (nullable para esbirros)
    spell_effect = Column(Enum(SpellEffect), nullable=True)
    spell_value = Column(Integer, nullable=True)

    image_url = Column(String, nullable=True)
    image_pos_x = Column(Integer, default=50)  # 0-100, % horizontal del recorte
    image_pos_y = Column(Integer, default=50)  # 0-100, % vertical del recorte
    image_scale = Column(Integer, default=100)  # 100 = sin zoom, 300 = 3x
    flavor_text = Column(String, nullable=True)
