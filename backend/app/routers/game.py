from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/game", tags=["game"])


@router.post("/result", response_model=schemas.GameResultResponse)
def report_result(
    data: schemas.GameResultRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deck = crud.get_deck(db, data.deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Mazo no encontrado")
    if deck.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso sobre este mazo")

    pack_awarded, packs_available = crud.register_game_result(db, current_user, deck, data.result)
    return {"packs_available": packs_available, "pack_awarded": pack_awarded}
