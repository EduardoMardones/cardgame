import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/collection", tags=["collection"])


@router.get("/me", response_model=list[schemas.CollectionEntry])
def get_my_collection(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.get_user_collection(db, current_user.id)


@router.post("/me/claim", response_model=list[schemas.CardOut])
def claim_origin(
    body: schemas.ClaimOriginRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        cards = crud.claim_origin(db, current_user, body.origin_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return cards


@router.post("/me/open-pack", response_model=schemas.OpenPackResult)
def open_pack(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        cards, packs_remaining = crud.open_pack(db, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return schemas.OpenPackResult(cards=cards, packs_remaining=packs_remaining)
