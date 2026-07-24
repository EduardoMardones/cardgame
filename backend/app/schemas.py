import uuid
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from .models import CardType, Keyword, Battlecry, Deathrattle, SpellEffect


class CardBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    mana_cost: int = Field(..., ge=0, le=20)
    card_type: CardType = CardType.minion
    legendary: bool = False

    attack: Optional[int] = Field(default=None, ge=0, le=20)
    health: Optional[int] = Field(default=None, ge=1, le=20)
    keyword: Keyword = Keyword.none
    battlecry: Battlecry = Battlecry.none
    deathrattle: Deathrattle = Deathrattle.none

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
        return self


class CardCreate(CardBase):
    pass


class CardUpdate(CardBase):
    pass


class CardOut(CardBase):
    id: uuid.UUID

    class Config:
        from_attributes = True
