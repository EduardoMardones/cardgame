import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/cards", tags=["cards"])

# Carpeta donde se guardan las imágenes subidas (dentro del contenedor/backend)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/{card_id}/image", response_model=schemas.CardOut)
async def upload_card_image(
    card_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    db_card = crud.get_card(db, card_id)
    if not db_card:
        raise HTTPException(status_code=404, detail="Carta no encontrada")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato de imagen no permitido")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="La imagen supera los 5MB")

    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    # Guardamos la ruta pública (servida como archivo estático) en la base de datos
    db_card.image_url = f"/static/uploads/{filename}"
    db.commit()
    db.refresh(db_card)
    return db_card


@router.get("/", response_model=list[schemas.CardOut])
def list_cards(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    return crud.get_cards(db, skip=skip, limit=limit)


@router.get("/{card_id}", response_model=schemas.CardOut)
def read_card(card_id: uuid.UUID, db: Session = Depends(get_db)):
    db_card = crud.get_card(db, card_id)
    if not db_card:
        raise HTTPException(status_code=404, detail="Carta no encontrada")
    return db_card


@router.post("/", response_model=schemas.CardOut, status_code=201)
def create_card(card: schemas.CardCreate, db: Session = Depends(get_db)):
    return crud.create_card(db, card)


@router.put("/{card_id}", response_model=schemas.CardOut)
def update_card(card_id: uuid.UUID, card: schemas.CardUpdate, db: Session = Depends(get_db)):
    db_card = crud.update_card(db, card_id, card)
    if not db_card:
        raise HTTPException(status_code=404, detail="Carta no encontrada")
    return db_card


@router.delete("/{card_id}", status_code=204)
def delete_card(card_id: uuid.UUID, db: Session = Depends(get_db)):
    db_card = crud.delete_card(db, card_id)
    if not db_card:
        raise HTTPException(status_code=404, detail="Carta no encontrada")
