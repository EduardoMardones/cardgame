# Creador de Cartas — Hearthstone Clone

Backend en FastAPI + Postgres, frontend en React + TypeScript.

## 1. Levantar Postgres + backend con Docker

Necesitás Docker y Docker Compose instalados.

```bash
cd card-creator
docker compose up --build
```

Esto levanta:
- Postgres en `localhost:5432` (usuario `cartas_user`, password `cartas_pass`, db `cartas_db`)
- La API FastAPI en `http://localhost:8000`

Podés probar la API en `http://localhost:8000/docs` (Swagger autogenerado).

### Alternativa sin Docker
Si ya tenés Postgres corriendo localmente:
```bash
createdb cartas_db
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://usuario:password@localhost:5432/cartas_db"
uvicorn app.main:app --reload
```

## 2. Levantar el frontend

```bash
cd frontend
npm install
npm run dev
```

Abrí `http://localhost:5173`. El formulario habla directo con `http://localhost:8000`
(está hardcodeado en `src/api.ts` — cambialo ahí si tu backend corre en otro puerto/host).

## 3. Qué hace esto

- Formulario visual para crear/editar cartas: nombre, coste de maná, tipo (esbirro/hechizo),
  ataque/vida, checks de Provocar / Carga / Vida robada, grito de guerra, estertor,
  legendaria, y para hechizos el efecto + valor.
- Lista de cartas ya creadas con botones de editar/borrar.
- Todo persiste en Postgres vía la API.

## 4. Cómo conectar esto al juego (siguiente paso)

Ahora mismo el juego (`hearthstone-clone-v2.html`) genera cartas al azar con `generateCardData()`.
El siguiente paso es que en vez de generar random, el juego haga:

```js
const res = await fetch('http://localhost:8000/cards/');
const cartasDisponibles = await res.json();
// elegir una al azar de cartasDisponibles, o armar un mazo específico
```

y usar esos datos (`mana_cost`, `attack`, `health`, `keyword`, etc.) para crear las cartas
en la mano, en vez de los valores random que genera `generateCardData()`.

Avisame cuando quieras dar ese paso y lo conectamos.
