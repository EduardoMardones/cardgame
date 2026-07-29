import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/decks", tags=["decks"])


def _get_own_deck_or_404(
    deck_id: uuid.UUID,
    current_user: models.User,
    db: Session,
) -> models.Deck:
    deck = crud.get_deck(db, deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Mazo no encontrado")
    if deck.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso sobre este mazo")
    return deck


@router.get("/", response_model=list[schemas.DeckOut])
def list_my_decks(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.get_user_decks(db, current_user.id)


@router.get("/{deck_id}", response_model=schemas.DeckOut)
def get_deck(
    deck_id: uuid.UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_own_deck_or_404(deck_id, current_user, db)


@router.post("/", response_model=schemas.DeckOut, status_code=201)
def create_deck(
    data: schemas.DeckCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_deck(db, current_user, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{deck_id}", response_model=schemas.DeckOut)
def update_deck(
    deck_id: uuid.UUID,
    data: schemas.DeckUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deck = _get_own_deck_or_404(deck_id, current_user, db)
    try:
        return crud.update_deck(db, current_user, deck, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{deck_id}", status_code=204)
def delete_deck(
    deck_id: uuid.UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deck = _get_own_deck_or_404(deck_id, current_user, db)
    crud.delete_deck(db, deck)
