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

# --- Colección ---

def get_user_collection(db: Session, user_id: uuid.UUID):
    return (
        db.query(models.UserCollection)
        .filter(models.UserCollection.user_id == user_id)
        .all()
    )


def has_claimed_origin(db: Session, user_id: uuid.UUID, origin_id: uuid.UUID) -> bool:
    return (
        db.query(models.ClaimLog)
        .filter_by(user_id=user_id, origin_id=origin_id)
        .first()
        is not None
    )


def claim_origin(db: Session, user: models.User, origin_id: uuid.UUID):
    """Asigna todas las cartas del origen al usuario. Lanza ValueError si ya reclamó."""
    if has_claimed_origin(db, user.id, origin_id):
        raise ValueError("Ya reclamaste ese origen")

    # Verificar que el origen existe
    origin = db.query(models.Origin).filter_by(id=origin_id).first()
    if not origin:
        raise LookupError("Origen no encontrado")

    # Obtener todas las cartas del origen
    cards = db.query(models.Card).filter(models.Card.origin == origin.name).all()

    # Insertar en colección (upsert manual)
    for card in cards:
        existing = (
            db.query(models.UserCollection)
            .filter_by(user_id=user.id, card_id=card.id)
            .first()
        )
        if existing:
            existing.quantity += 1
        else:
            db.add(models.UserCollection(user_id=user.id, card_id=card.id, quantity=1))

    # Registrar el claim
    db.add(models.ClaimLog(user_id=user.id, origin_id=origin_id))
    db.commit()
    return cards


def open_pack(db: Session, user: models.User, pack_size: int = 5):
    """Abre un sobre: descuenta 1 pack y asigna `pack_size` cartas al azar."""
    if user.packs_available < 1:
        raise ValueError("No tienes sobres disponibles")

    all_cards = db.query(models.Card).all()
    if not all_cards:
        raise ValueError("No hay cartas en el catálogo")

    import random
    chosen = random.choices(all_cards, k=min(pack_size, len(all_cards)))

    for card in chosen:
        existing = (
            db.query(models.UserCollection)
            .filter_by(user_id=user.id, card_id=card.id)
            .first()
        )
        if existing:
            existing.quantity += 1
        else:
            db.add(models.UserCollection(user_id=user.id, card_id=card.id, quantity=1))

    user.packs_available -= 1
    db.commit()
    return chosen, user.packs_available

# --- Mazos ---

MAX_CARDS_PER_DECK = 30
MAX_COPIES_PER_CARD = 2


def get_user_decks(db: Session, user_id: uuid.UUID):
    return db.query(models.Deck).filter(models.Deck.user_id == user_id).all()


def get_deck(db: Session, deck_id: uuid.UUID):
    return db.query(models.Deck).filter(models.Deck.id == deck_id).first()


def create_deck(db: Session, user: models.User, data: schemas.DeckCreate):
    _validate_deck_cards(db, user, data.mode, data.cards)

    deck = models.Deck(user_id=user.id, name=data.name, mode=data.mode)
    db.add(deck)
    db.flush()  # obtenemos deck.id sin commitear

    for item in data.cards:
        db.add(models.DeckCard(deck_id=deck.id, card_id=item.card_id, quantity=item.quantity))

    db.commit()
    db.refresh(deck)
    return deck


def update_deck(db: Session, user: models.User, deck: models.Deck, data: schemas.DeckUpdate):
    _validate_deck_cards(db, user, deck.mode, data.cards)

    deck.name = data.name

    # Reemplazar cartas: borrar las existentes y reinsertar
    db.query(models.DeckCard).filter(models.DeckCard.deck_id == deck.id).delete()
    for item in data.cards:
        db.add(models.DeckCard(deck_id=deck.id, card_id=item.card_id, quantity=item.quantity))

    db.commit()
    db.refresh(deck)
    return deck


def delete_deck(db: Session, deck: models.Deck):
    db.delete(deck)
    db.commit()


def _validate_deck_cards(
    db: Session,
    user: models.User,
    mode: models.DeckMode,
    cards: list[schemas.DeckCardInput],
):
    """Valida reglas de negocio del mazo. Lanza ValueError si algo no cumple."""
    total = sum(item.quantity for item in cards)
    if total > MAX_CARDS_PER_DECK:
        raise ValueError(f"El mazo no puede tener más de {MAX_CARDS_PER_DECK} cartas (tiene {total})")

    for item in cards:
        if item.quantity > MAX_COPIES_PER_CARD:
            raise ValueError(f"No puedes tener más de {MAX_COPIES_PER_CARD} copias de la misma carta")

    if mode == models.DeckMode.normal:
        # En modo normal, todas las cartas deben estar en la colección del usuario
        collection_map = {
            uc.card_id: uc.quantity
            for uc in db.query(models.UserCollection)
            .filter(models.UserCollection.user_id == user.id)
            .all()
        }
        for item in cards:
            owned = collection_map.get(item.card_id, 0)
            if item.quantity > owned:
                card = db.query(models.Card).filter(models.Card.id == item.card_id).first()
                name = card.name if card else str(item.card_id)
                raise ValueError(
                    f"No tienes suficientes copias de '{name}' "
                    f"(necesitas {item.quantity}, tienes {owned})"
                )

# --- Resultado de partida ---

def register_game_result(db: Session, user: models.User, deck: models.Deck, result: str) -> tuple[bool, int]:
    """Aplica las recompensas de fin de partida. Devuelve (se_otorgo_sobre, packs_available)."""
    pack_awarded = False
    if deck.mode == models.DeckMode.normal and result == "win":
        user.packs_available += 1
        pack_awarded = True
        db.commit()
        db.refresh(user)
    return pack_awarded, user.packs_available
