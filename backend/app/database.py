import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Ejemplo: postgresql://usuario:password@localhost:5432/cartas_db
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://cartas_user:cartas_pass@localhost:5432/cartas_db",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
