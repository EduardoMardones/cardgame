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


# --- CRUD genérico para catálogos (Origin, Archetype, Team) ---
# Los tres modelos son estructuralmente iguales (id, name, icon), así que
# un solo set de funciones parametrizado por `model` sirve para los tres
# en vez de triplicar el mismo código.

def get_catalog_entries(db: Session, model):
    return db.query(model).order_by(model.name).all()


def create_catalog_entry(db: Session, model, entry: schemas.CatalogEntryCreate):
    db_entry = model(**entry.model_dump())
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


def delete_catalog_entry(db: Session, model, entry_id: uuid.UUID):
    db_entry = db.query(model).filter(model.id == entry_id).first()
    if not db_entry:
        return None
    db.delete(db_entry)
    db.commit()
    return db_entry
