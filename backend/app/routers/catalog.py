import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(prefix="/catalog", tags=["catalog"])

# Un solo router para los tres catálogos (Origen, Arquetipo, Equipo), ya
# que son idénticos en forma (solo nombre + ícono opcional). Cada bloque
# de abajo repite las mismas 3 rutas (listar/crear/borrar) apuntando a un
# modelo distinto, en vez de tener tres routers casi iguales.


# --- Orígenes ---

@router.get("/origins", response_model=list[schemas.OriginOut])
def list_origins(db: Session = Depends(get_db)):
    return crud.get_catalog_entries(db, models.Origin)


@router.post("/origins", response_model=schemas.OriginOut, status_code=201)
def create_origin(entry: schemas.OriginCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_catalog_entry(db, models.Origin, entry)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ese origen ya existe")


@router.delete("/origins/{entry_id}", status_code=204)
def delete_origin(entry_id: uuid.UUID, db: Session = Depends(get_db)):
    if not crud.delete_catalog_entry(db, models.Origin, entry_id):
        raise HTTPException(status_code=404, detail="Origen no encontrado")


# --- Arquetipos ---

@router.get("/archetypes", response_model=list[schemas.ArchetypeOut])
def list_archetypes(db: Session = Depends(get_db)):
    return crud.get_catalog_entries(db, models.Archetype)


@router.post("/archetypes", response_model=schemas.ArchetypeOut, status_code=201)
def create_archetype(entry: schemas.ArchetypeCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_catalog_entry(db, models.Archetype, entry)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ese arquetipo ya existe")


@router.delete("/archetypes/{entry_id}", status_code=204)
def delete_archetype(entry_id: uuid.UUID, db: Session = Depends(get_db)):
    if not crud.delete_catalog_entry(db, models.Archetype, entry_id):
        raise HTTPException(status_code=404, detail="Arquetipo no encontrado")


# --- Equipos (ex "Asociaciones") ---

@router.get("/teams", response_model=list[schemas.TeamOut])
def list_teams(db: Session = Depends(get_db)):
    return crud.get_catalog_entries(db, models.Team)


@router.post("/teams", response_model=schemas.TeamOut, status_code=201)
def create_team(entry: schemas.TeamCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_catalog_entry(db, models.Team, entry)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ese equipo ya existe")


@router.delete("/teams/{entry_id}", status_code=204)
def delete_team(entry_id: uuid.UUID, db: Session = Depends(get_db)):
    if not crud.delete_catalog_entry(db, models.Team, entry_id):
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
