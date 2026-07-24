import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import cards

# Crea las tablas si no existen (para un proyecto más grande, usar Alembic en vez de esto)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cartas API")

app.add_middleware(
    CORSMiddleware,
    # En desarrollo permitimos cualquier origen para poder abrir el prototipo
    # de juego (game.html) directamente desde el navegador, un servidor local
    # distinto, etc. Para producción, restringir a los dominios reales.
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sirve las imágenes subidas en /static/uploads/<archivo>
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(STATIC_DIR, "uploads"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(cards.router)


@app.get("/health")
def health():
    return {"status": "ok"}
