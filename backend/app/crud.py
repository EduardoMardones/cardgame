import uuid
from sqlalchemy.orm import Session

from . import models, schemas


def get_cards(db: Session, skip: int = 0, limit: int = 200):
    return db.query(models.Card).offset(skip).limit(limit).all()


def get_card(db: Session, card_id: uuid.UUID):
    return db.query(models.Card).filter(models.Card.id == card_id).first()


def create_card(db: Session, card: schemas.CardCreate):
    db_card = models.Card(**card.model_dump())
    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    return db_card


def update_card(db: Session, card_id: uuid.UUID, card: schemas.CardUpdate):
    db_card = get_card(db, card_id)
    if not db_card:
        return None
    for key, value in card.model_dump().items():
        setattr(db_card, key, value)
    db.commit()
    db.refresh(db_card)
    return db_card


def delete_card(db: Session, card_id: uuid.UUID):
    db_card = get_card(db, card_id)
    if not db_card:
        return None
    db.delete(db_card)
    db.commit()
    return db_card
