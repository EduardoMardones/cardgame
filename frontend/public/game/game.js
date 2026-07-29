// --- Config de conexión y parámetros de la URL (Paso 6.2) ---
const API_BASE = 'http://localhost:8000';

const urlParams = new URLSearchParams(window.location.search);
const DECK_ID = urlParams.get('deckId');   // mazo elegido en DeckSelectPage
const AUTH_TOKEN = urlParams.get('token'); // JWT del usuario logueado

function authHeaders() {
    return AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {};
}

// Constantes de balance del juego. Tocar acá para ajustar reglas
// sin tener que buscar números sueltos por el resto del archivo.
const CONFIG = {
    DECK_SIZE: 30,       // cartas iniciales del mazo de cada jugador
    STARTING_HP: 30,     // vida inicial de cada héroe
    MAX_HAND_SIZE: 10,   // cartas máximas en mano
    MAX_MINIONS: 7,      // esbirros máximos en el campo por jugador
    MAX_MANA: 10,        // maná máximo alcanzable
};

class EventBus {
    constructor() {
        this.listeners = {};
    }
    on(eventName, callback) {
        if (!this.listeners[eventName]) this.listeners[eventName] = [];
        this.listeners[eventName].push(callback);
    }
    off(eventName, callback) {
        if (!this.listeners[eventName]) return;
        this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
    }
    emit(eventName, context) {
        (this.listeners[eventName] || []).slice().forEach(cb => cb(context));
    }
}

class AbilitySystem {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.effectHandlers = {};
        this.cardListeners = new Map();
    }
    registerEffect(effectName, handlerFn) {
        this.effectHandlers[effectName] = handlerFn;
    }
    registerCard(cardId, abilities, extraContext) {
        const listeners = [];
        (abilities || []).forEach(ability => {
            const callback = (context) => {
                const handler = this.effectHandlers[ability.effect];
                if (handler) handler(ability.params || {}, { ...context, ...extraContext });
            };
            this.eventBus.on(ability.trigger, callback);
            listeners.push({ trigger: ability.trigger, callback });
        });
        this.cardListeners.set(cardId, listeners);
    }
    unregisterCard(cardId) {
        const listeners = this.cardListeners.get(cardId) || [];
        listeners.forEach(({ trigger, callback }) => this.eventBus.off(trigger, callback));
        this.cardListeners.delete(cardId);
    }
}

const eventBus = new EventBus();
const abilitySystem = new AbilitySystem(eventBus);

function legacyToAbilities(data) {
    const abilities = [];
    if (data.battlecry === 'damage_enemy_hero') {
        abilities.push({ trigger: 'ON_ENTER', effect: 'DEAL_DAMAGE', params: { amount: 1, target: 'ENEMY_HERO' } });
    }
    if (data.deathrattle === 'draw_card') {
        abilities.push({ trigger: 'ON_DEATH', effect: 'DRAW_CARD', params: { amount: 1, player: 'OWNER' } });
    }
    return abilities;
}

function cardAbilities(data) {
    return Array.isArray(data.abilities) && data.abilities.length ? data.abilities : legacyToAbilities(data);
}

const targetResolver = {
    resolve(targetType, context) {
        switch (targetType) {
            case 'ENEMY_HERO': return context.enemySide;
            case 'OWNER_HERO': return context.owner;
            case 'RANDOM_ENEMY_MINION': {
                const minions = Array.from(document.getElementById(context.enemySide + '-minions').children);
                return minions.length ? pick(minions) : null;
            }
            case 'RANDOM_OWN_MINION': {
                const minions = Array.from(document.getElementById(context.owner + '-minions').children)
                    .filter(m => m !== context.minionEl);
                return minions.length ? pick(minions) : null;
            }
            case 'ANY_ENEMY': {
                const minions = Array.from(document.getElementById(context.enemySide + '-minions').children);
                return pick([context.enemySide, ...minions]);
            }
            case 'ANY_OWN': {
                const minions = Array.from(document.getElementById(context.owner + '-minions').children)
                    .filter(m => m !== context.minionEl);
                return pick([context.owner, ...minions]);
            }
            default: return null;
        }
    },
    // Los targets "CHOOSE_*" son los que el jugador elige a mano en vez de
    // que se resuelvan solos (random / fijo). Se identifican por prefijo
    // para no tener que listarlos uno por uno en cada lugar que pregunta.
    isManual(targetType) {
        return typeof targetType === 'string' && targetType.startsWith('CHOOSE_');
    },
    // Dado un target manual, arma el pool de elementos que se pueden elegir:
    // { minions: [...], heroes: ['player'|'enemy', ...] }
    resolveManualPool(targetType, context) {
        switch (targetType) {
            case 'CHOOSE_ENEMY_MINION':
            case 'CHOOSE_ENEMY_MINIONS':
                return { minions: this.resolveMinionPool('ENEMY_MINIONS', context), heroes: [] };
            case 'CHOOSE_OWN_MINION':
            case 'CHOOSE_OWN_MINIONS':
                return { minions: this.resolveMinionPool('OWN_MINIONS', context), heroes: [] };
            case 'CHOOSE_ANY_MINION':
            case 'CHOOSE_ANY_MINIONS':
                return { minions: this.resolveMinionPool('ANY_MINIONS', context), heroes: [] };
            case 'CHOOSE_ANY_ENEMY':
                return { minions: this.resolveMinionPool('ENEMY_MINIONS', context), heroes: [context.enemySide] };
            case 'CHOOSE_ANY_OWN':
                return { minions: this.resolveMinionPool('OWN_MINIONS', context), heroes: [context.owner] };
            default:
                return { minions: [], heroes: [] };
        }
    },
    resolveMinionPool(poolType, context) {
        const playerMinions = () => Array.from(document.getElementById('player-minions').children);
        const enemyMinions = () => Array.from(document.getElementById('enemy-minions').children);
        const ownMinions = () => Array.from(document.getElementById(context.owner + '-minions').children);
        const rivalMinions = () => Array.from(document.getElementById(context.enemySide + '-minions').children);

        switch (poolType) {
            case 'ENEMY_MINIONS': return rivalMinions();
            case 'OWN_MINIONS': return ownMinions().filter(m => m !== context.minionEl);
            case 'ANY_MINIONS': return [...playerMinions(), ...enemyMinions()].filter(m => m !== context.minionEl);
            case 'ALL_MINIONS': return [...playerMinions(), ...enemyMinions()].filter(m => m !== context.minionEl);
            default: return [];
        }
    }
};

function applyDealDamage(target, amount, context) {
    if (!target) return;
    if (target === 'player' || target === 'enemy') {
        dealDamageToHero(target, amount);
    } else {
        damageMinion(target, amount);
    }
    log(`${context.owner === 'player' ? 'Tu carta activa' : 'La carta rival activa'} una habilidad: ${amount} de daño.`);
}

abilitySystem.registerEffect('DEAL_DAMAGE', (params, context) => {
    if (targetResolver.isManual(params.target)) {
        requestManualTarget(params.target, context, (target) => applyDealDamage(target, params.amount, context));
        return;
    }
    const target = targetResolver.resolve(params.target, context);
    applyDealDamage(target, params.amount, context);
});

function applyHeal(target, amount, context) {
    if (!target) return;
    if (target === 'player' || target === 'enemy') {
        healHero(target, amount);
    } else {
        healMinion(target, amount);
    }
    log(`${context.owner === 'player' ? 'Te curás' : 'El rival se cura'} ${amount} por una habilidad.`);
}

abilitySystem.registerEffect('HEAL', (params, context) => {
    if (targetResolver.isManual(params.target)) {
        requestManualTarget(params.target, context, (target) => applyHeal(target, params.amount, context));
        return;
    }
    const target = targetResolver.resolve(params.target || 'OWNER_HERO', context);
    applyHeal(target, params.amount, context);
});

abilitySystem.registerEffect('DRAW_CARD', (params, context) => {
    const side = (!params.player || params.player === 'OWNER') ? context.owner : context.enemySide;
    const amount = params.amount || 1;
    for (let i = 0; i < amount; i++) drawCard(side);
    log(`${side === 'player' ? 'Robaste' : 'El rival roba'} ${amount} carta(s) por una habilidad.`);
});

abilitySystem.registerEffect('GIVE_CHARGE', (params, context) => {
    if (context.minionEl) context.minionEl.classList.remove('exhausted');
});

function applyReturnToHand(chosen, context) {
    chosen.forEach(m => returnMinionToHand(m));
    if (chosen.length) {
        log(`${context.owner === 'player' ? 'Devolviste' : 'El rival devuelve'} ${chosen.length} esbirro(s) a la mano por una habilidad.`);
    }
}

abilitySystem.registerEffect('RETURN_TO_HAND', (params, context) => {
    if (targetResolver.isManual(params.target)) {
        requestManualMinionTargets(params.target, params.amount || 1, context, (chosen) => applyReturnToHand(chosen, context));
        return;
    }

    const pool = targetResolver.resolveMinionPool(params.target || 'ENEMY_MINIONS', context);
    if (!pool.length) return;

    const chosen = params.target === 'ALL_MINIONS'
        ? pool
        : shuffle(pool.slice()).slice(0, params.amount || 1);

    applyReturnToHand(chosen, context);
});

function resolveImg(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return API_BASE + path;
}

function mapDbCardToGameData(dbCard) {
    const base = {
        name: dbCard.name,
        image: resolveImg(dbCard.image_url),
        imagePosX: dbCard.image_pos_x ?? 50,
        imagePosY: dbCard.image_pos_y ?? 50,
        imageScale: dbCard.image_scale ?? 100,
        flavor: dbCard.flavor_text || '',
        legendary: !!dbCard.legendary,
        mana: dbCard.mana_cost,
        fromDb: true,
    };

    if (dbCard.card_type === 'spell') {
        return {
            ...base,
            type: 'spell',
            effect: dbCard.spell_effect,
            value: dbCard.spell_value ?? 0,
        };
    }

    return {
        ...base,
        type: 'minion',
        atk: dbCard.attack ?? 0,
        hp: dbCard.health ?? 1,
        keyword: dbCard.keyword && dbCard.keyword !== 'none' ? dbCard.keyword : 'none',
        battlecry: dbCard.battlecry && dbCard.battlecry !== 'none' ? dbCard.battlecry : null,
        deathrattle: dbCard.deathrattle && dbCard.deathrattle !== 'none' ? dbCard.deathrattle : null,
        abilities: Array.isArray(dbCard.abilities) ? dbCard.abilities : [],
        origin: dbCard.origin || null,
        archetypes: dbCard.archetypes || [],
        teams: dbCard.teams || [],
        };
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function fetchDeckCards() {
    // Modo Paso 6: cargar el mazo elegido por el usuario (GET /decks/me/{id})
    if (!DECK_ID) return null;
    try {
        const res = await fetch(`${API_BASE}/decks/${DECK_ID}`, { headers: authHeaders() });
        if (!res.ok) {
            console.warn('No se pudo cargar el mazo seleccionado, se usará mazo de prueba.');
            return null;
        }
        const deck = await res.json();
        state.deckMode = deck.mode; // 'free' | 'normal' — se usa al reportar resultado

        // Expande quantity: si una carta tiene quantity=2, aparece 2 veces en el mazo
        const cards = [];
        (deck.cards || []).forEach((entry) => {
            for (let i = 0; i < entry.quantity; i++) cards.push(mapDbCardToGameData(entry.card));
        });
        return cards;
    } catch (err) {
        console.warn('Error al cargar el mazo seleccionado:', err);
        return null;
    }
}

async function fetchCatalogCards() {
    try {
        const res = await fetch(`${API_BASE}/cards/`, { headers: authHeaders() });
        if (res.ok) return (await res.json()).map(mapDbCardToGameData);
    } catch (err) {
        console.warn('No se pudo conectar con el backend de cartas (¿está corriendo en :8000?).', err);
    }
    return [];
}

async function loadPlayerDeck() {
    let deckCards = await fetchDeckCards();

    if (!deckCards) {
        // Fallback: sin deckId (juego suelto desde game.html) o el mazo no cargó.
        // Se mantiene el comportamiento viejo: cartas reales del catálogo + relleno de prueba.
        const catalogCards = await fetchCatalogCards();
        deckCards = catalogCards.slice(0, CONFIG.DECK_SIZE);
        log(`Mazo armado: ${catalogCards.length} carta(s) real(es) del catálogo.`);
    } else {
        log(`Mazo cargado: "${state.deckMode === 'normal' ? 'modo normal' : 'modo libre'}", ${deckCards.length} carta(s).`);
    }

    while (deckCards.length < CONFIG.DECK_SIZE) {
        deckCards.push(generateCardData());
    }
    if (deckCards.length > CONFIG.DECK_SIZE) {
        deckCards = deckCards.slice(0, CONFIG.DECK_SIZE);
    }

    state.player.deckCards = shuffle(deckCards);
}

async function loadEnemyDeck() {
    // Paso 6.2: el mazo de la IA se arma al azar del catálogo global,
    // con relleno de cartas de prueba si el catálogo tiene pocas cartas.
    const catalogCards = await fetchCatalogCards();
    let deckCards = shuffle(catalogCards.slice()).slice(0, CONFIG.DECK_SIZE);
    while (deckCards.length < CONFIG.DECK_SIZE) {
        deckCards.push(generateCardData());
    }
    state.enemy.deckCards = shuffle(deckCards);
}


const state = {
    turn: 1,
    activePlayer: 'player',
    gameOver: false,
    selectedAttacker: null,
  pendingAbility: null,
  deckMode: 'free',
    player: { maxMana: 1, mana: 1, deck: CONFIG.DECK_SIZE, hp: CONFIG.STARTING_HP, heroPowerUsed: false, minionCount: 0, handCount: 0, deckCards: [] },
    enemy:  { maxMana: 1, mana: 1, deck: CONFIG.DECK_SIZE, hp: CONFIG.STARTING_HP, heroPowerUsed: false, minionCount: 0, handCount: 0, hand: [] }
};

function log(msg) {
    const el = document.getElementById('log');
    const line = document.createElement('div');
    line.textContent = msg;
    el.prepend(line);
    while (el.children.length > 7) el.removeChild(el.lastChild);
}

function renderInitialStats() {
    document.getElementById('player-hp').innerText = state.player.hp;
    document.getElementById('enemy-hp').innerText = state.enemy.hp;
    document.getElementById('deck-count').innerText = `${state.player.deck}/${CONFIG.DECK_SIZE}`;
    document.getElementById('enemy-deck-count').innerText = `${state.enemy.deck}/${CONFIG.DECK_SIZE}`;
}

function showOverlay(text) {
    const ov = document.getElementById('overlay-msg');
    ov.textContent = text;
    ov.style.display = 'flex';
}

const KEYWORDS = ['none', 'none', 'none', 'taunt', 'charge', 'lifesteal'];
const BATTLECRIES = [null, null, null, 'damage_enemy_hero'];
const DEATHRATTLES = [null, null, null, 'draw_card'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateCardData() {
    const isSpell = Math.random() < 0.25;
    const mana = Math.floor(Math.random() * 6) + 1;

    if (isSpell) {
        const effects = ['damage_enemy_hero', 'heal_hero', 'draw_two', 'damage_enemy_minion'];
        const effect = pick(effects);
        let value = 0;
        if (effect === 'damage_enemy_hero' || effect === 'damage_enemy_minion') value = Math.max(1, Math.floor(mana * 0.8));
        if (effect === 'heal_hero') value = mana + 2;
        return { type: 'spell', mana, effect, value, legendary: false, name: 'Hechizo de prueba' };
    }

    const atk = Math.floor(Math.random() * mana);
    const hp = Math.max(1, mana - atk + (Math.random() > 0.5 ? 1 : -1));
    const keyword = pick(KEYWORDS);
    const battlecry = pick(BATTLECRIES);
    const deathrattle = pick(DEATHRATTLES);
    const legendary = Math.random() > 0.85;

    return { type: 'minion', mana, atk, hp, keyword, battlecry, deathrattle, legendary, name: 'Esbirro de prueba' };
}

function spellText(effect, value) {
    switch (effect) {
        case 'damage_enemy_hero': return `Inflige ${value} de daño al héroe enemigo.`;
        case 'heal_hero': return `Restaura ${value} de vida a tu héroe.`;
        case 'draw_two': return `Roba 2 cartas.`;
        case 'damage_enemy_minion': return `Inflige ${value} de daño a un esbirro enemigo al azar.`;
    }
    return '';
}

function keywordLabel(k) {
    if (k === 'taunt') return 'PROVOCAR';
    if (k === 'charge') return 'CARGA';
    if (k === 'lifesteal') return 'VIDA ROBADA';
    return '';
}

function renderManaBar() {
    const bar = document.getElementById('mana-bar');
    bar.querySelectorAll('.mana-crystal').forEach(c => c.remove());
    for (let i = 0; i < state.player.maxMana; i++) {
        const crystal = document.createElement('div');
        crystal.className = 'mana-crystal' + (i < state.player.mana ? '' : ' empty');
        bar.insertBefore(crystal, document.getElementById('mana-label'));
    }
    document.getElementById('mana-label').innerText = `${state.player.mana}/${state.player.maxMana}`;

    const enemyBar = document.getElementById('enemy-mana-bar');
    enemyBar.querySelectorAll('.mana-crystal').forEach(c => c.remove());
    for (let i = 0; i < state.enemy.maxMana; i++) {
        const crystal = document.createElement('div');
        crystal.className = 'mana-crystal' + (i < state.enemy.mana ? '' : ' empty');
        enemyBar.insertBefore(crystal, document.getElementById('enemy-mana-label'));
    }
    document.getElementById('enemy-mana-label').innerText = `${state.enemy.mana}/${state.enemy.maxMana}`;
    refreshPlayability();
}

function refreshPlayability() {
    const canPlay = state.activePlayer === 'player' && !state.gameOver;
    document.querySelectorAll('#player-hand .card').forEach(card => {
        const cost = parseInt(card.dataset.mana);
        card.classList.toggle('unplayable', !canPlay || cost > state.player.mana);
        card.draggable = canPlay && cost <= state.player.mana;
    });
    document.getElementById('deck').classList.toggle('disabled', !canPlay || state.player.handCountFull());
}
state.player.handCountFull = () => state.player.handCount >= CONFIG.MAX_HAND_SIZE;

function refreshEnemyHandFan() {
    const cards = Array.from(document.getElementById('enemy-hand').children);
    const n = cards.length;
    cards.forEach((back, i) => {
        const rot = (i - (n - 1) / 2) * -8;
        back.style.transform = `rotate(${rot}deg) translateY(${-Math.abs(rot) * 0.8}px)`;
    });
}

function drawCard(side) {
    const p = state[side];
    if (p.handCount >= CONFIG.MAX_HAND_SIZE) { log(side === 'player' ? 'Tu mano está llena.' : 'La mano del rival está llena.'); return; }
    if (p.deck <= 0) { log(side === 'player' ? '¡Tu mazo está vacío!' : 'El mazo rival está vacío.'); return; }

    p.deck--;
    if (side === 'player') document.getElementById('deck-count').innerText = `${p.deck}/${CONFIG.DECK_SIZE}`;
    else document.getElementById('enemy-deck-count').innerText = `${p.deck}/${CONFIG.DECK_SIZE}`;

    const data = p.deckCards.shift() || generateCardData();
    addCardToHand(side, data);
}

function addCardToHand(side, data) {
    const p = state[side];
    if (p.handCount >= CONFIG.MAX_HAND_SIZE) { log(side === 'player' ? 'Tu mano está llena.' : 'La mano del rival está llena.'); return false; }
    p.handCount++;

    if (side === 'enemy') {
        data.id = 'ecard-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        state.enemy.hand.push(data);
        const handEl = document.getElementById('enemy-hand');
        const back = document.createElement('div');
        back.className = 'card-back';
        back.id = 'back-' + data.id;
        handEl.appendChild(back);
        refreshEnemyHandFan();
        return true;
    }

    renderPlayerHandCard(data);
    return true;
}

function renderPlayerHandCard(data) {
    const hand = document.getElementById('player-hand');
    const card = document.createElement('div');
    card.id = 'card-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    card.className = 'card drawing' + (data.type === 'spell' ? ' spell-card' : '');
    card.dataset.mana = data.mana;
    card.dataset.type = data.type;
    card.dataset.name = data.name || '';
    card.dataset.flavor = data.flavor || '';
    card.dataset.origin = data.origin || '';
    card.dataset.archetypes = JSON.stringify(data.archetypes || []);
    card.dataset.teams = JSON.stringify(data.teams || []);

    const artInner = data.image
        ? `<div class="card-art-img" style="background-image: url('${data.image}'); background-position: ${data.imagePosX ?? 50}% ${data.imagePosY ?? 50}%; transform: scale(${(data.imageScale ?? 100) / 100}); transform-origin: ${data.imagePosX ?? 50}% ${data.imagePosY ?? 50}%;"></div>`
        : '';

    if (data.type === 'minion') {
        card.dataset.atk = data.atk;
        card.dataset.hp = data.hp;
        card.dataset.keyword = data.keyword;
        card.dataset.battlecry = data.battlecry || '';
        card.dataset.deathrattle = data.deathrattle || '';
        if (data.legendary) { card.style.borderColor = 'var(--legendary)'; card.dataset.legendary = '1'; }

        const abilities = cardAbilities(data);
        card.dataset.abilities = JSON.stringify(abilities);
        const hasEnter = abilities.some(a => a.trigger === 'ON_ENTER');
        const hasDeath = abilities.some(a => a.trigger === 'ON_DEATH');
        const abilitiesFullText = describeAbilities(abilities);

        const kwTag = data.keyword !== 'none' ? `<div class="keyword-tag k-${data.keyword}">${keywordLabel(data.keyword)}</div>` : '';

        const archetypes = data.archetypes || [];
        const teams = data.teams || [];
        const tagIcons = `
            ${archetypes[0] ? `<div class="tag-icon" title="Arquetipo: ${archetypes[0]}">${archetypeIconSvg(archetypes[0])}</div>` : ''}
            ${teams[0] ? `<div class="tag-icon" title="Equipo: ${teams[0]}">${teamIconSvg(teams[0])}</div>` : ''}
        `;

        const originChip = data.origin ? `<span class="chip origin">${data.origin}</span>` : '';
        const archetypeChips = archetypes.map(a => `<span class="chip">${archetypeIconSvg(a)}${a}</span>`).join('');
        const teamChips = teams.map(a => `<span class="chip">${teamIconSvg(a)}${a}</span>`).join('');

        card.innerHTML = `
            <div class="card-art">${artInner}</div>
            <div class="mana-cost">${data.mana}</div>
            ${kwTag}
            <div class="tag-icons">${tagIcons}</div>
            <div class="card-name">${data.name || (data.legendary ? 'LEGENDARIA' : 'Esbirro')}</div>
            <div class="card-text">${hasEnter ? 'Grito de guerra' : ''}${hasEnter && hasDeath ? ' · ' : ''}${hasDeath ? 'Estertor' : ''}</div>
            <div class="atk-value">${data.atk}</div>
            <div class="hp-value">${data.hp}</div>

            <div class="expanded-panel">
                ${abilitiesFullText ? `<div class="exp-ability">${abilitiesFullText}</div>` : ''}
                ${(originChip || archetypeChips || teamChips) ? `<div class="exp-chips">${originChip}${archetypeChips}${teamChips}</div>` : ''}
                ${data.flavor ? `<div class="exp-flavor">"${data.flavor}"</div>` : ''}
            </div>
        `;
    } else {
        card.dataset.effect = data.effect;
        card.dataset.value = data.value;
        card.innerHTML = `
            <div class="card-art">${artInner}</div>
            <div class="mana-cost">${data.mana}</div>
            <div class="card-name">${data.name || 'Hechizo'}</div>
            <div class="card-text">${spellText(data.effect, data.value)}</div>

            <div class="expanded-panel">
                <div class="exp-ability">${spellText(data.effect, data.value)}</div>
                ${data.flavor ? `<div class="exp-flavor">"${data.flavor}"</div>` : ''}
            </div>
        `;
    }

    card.dataset.image = data.image || '';
    card.dataset.imagePosX = data.imagePosX ?? 50;
    card.dataset.imagePosY = data.imagePosY ?? 50;
    card.dataset.imageScale = data.imageScale ?? 100;

    const rot = (state.player.handCount - 3) * 6;
    card.style.setProperty('--r', `${rot}deg`);
    card.style.transform = `rotate(${rot}deg)`;

    card.ondragstart = (e) => { e.dataTransfer.setData('text', card.id); card.classList.add('dragging'); };
    card.ondragend = () => card.classList.remove('dragging');

    hand.appendChild(card);
    setTimeout(() => card.classList.remove('drawing'), 500);
    refreshPlayability();
}

const ARCHETYPE_ICONS = {
    "espadachin": `<svg viewBox="0 0 24 24" fill="none" stroke="#f3d430" stroke-width="2"><path d="M4 20 L18 6 M14 2 L22 10 M2 22 L6 18"/></svg>`,
    "mago": `<svg viewBox="0 0 24 24" fill="none" stroke="#f3d430" stroke-width="2"><path d="M12 2 L14 9 L21 10 L15 14 L17 21 L12 17 L7 21 L9 14 L3 10 L10 9 Z"/></svg>`,
    "stand user": `<svg viewBox="0 0 24 24" fill="none" stroke="#f3d430" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 22 C6 16 18 16 18 22"/></svg>`,
};

const TEAM_ICONS = {
    "mugiwaras": `<svg viewBox="0 0 24 24" fill="none" stroke="#bfe0f0" stroke-width="2"><path d="M2 12 a10 6 0 0 1 20 0"/><circle cx="12" cy="12" r="2" fill="#bfe0f0"/></svg>`,
    "crazy diamond": `<svg viewBox="0 0 24 24" fill="none" stroke="#bfe0f0" stroke-width="2"><path d="M12 2 L20 9 L12 22 L4 9 Z"/></svg>`,
};

function fallbackIcon(label) {
    const initial = (label || "?").trim().charAt(0).toUpperCase();
    return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#c3a05b" stroke-width="2"/>
            <text x="12" y="16" text-anchor="middle" font-size="11" fill="#f3d430" font-family="Georgia">${initial}</text></svg>`;
}

function archetypeIconSvg(name) {
    return ARCHETYPE_ICONS[(name || "").toLowerCase()] || fallbackIcon(name);
}
function teamIconSvg(name) {
    return TEAM_ICONS[(name || "").toLowerCase()] || fallbackIcon(name);
}

const TRIGGER_LABELS = {
    ON_ENTER: "Grito de guerra",
    ON_DEATH: "Estertor",
    ON_ATTACK: "Al atacar",
    ON_DAMAGE_TAKEN: "Al recibir daño",
    ON_HEAL: "Al ser curado",
    ON_TURN_START: "Al inicio de tu turno",
    ON_TURN_END: "Al final de tu turno",
    ON_SPELL_CAST: "Al lanzar un hechizo",
    ON_FRIENDLY_DEATH: "Cuando muere un aliado",
    ON_ENEMY_ATTACK: "Cuando el rival ataca",
    ON_DRAW: "Al robar",
    ON_DAMAGE_DEALT: "Al infligir daño",
};

const TARGET_LABELS = {
    ENEMY_HERO: "al héroe enemigo",
    OWNER_HERO: "a tu héroe",
    RANDOM_ENEMY_MINION: "a un esbirro enemigo al azar",
    RANDOM_OWN_MINION: "a un esbirro aliado al azar",
    ANY_ENEMY: "a algo del rival al azar",
    ANY_OWN: "a algo tuyo al azar",
    ENEMY_MINIONS: "a los esbirros enemigos",
    OWN_MINIONS: "a tus esbirros",
    ANY_MINIONS: "a cualquier esbirro",
    ALL_MINIONS: "a todos los esbirros",
    CHOOSE_ENEMY_MINION: "a un esbirro enemigo (elegís vos)",
    CHOOSE_ANY_ENEMY: "a algo del rival (elegís vos)",
    CHOOSE_OWN_MINION: "a un esbirro aliado (elegís vos)",
    CHOOSE_ANY_OWN: "a algo tuyo (elegís vos)",
    CHOOSE_ENEMY_MINIONS: "a esbirros enemigos (elegís vos)",
    CHOOSE_OWN_MINIONS: "a tus esbirros (elegís vos)",
    CHOOSE_ANY_MINIONS: "a esbirros (elegís vos)",
};

function describeEffect(effect, params = {}) {
    switch (effect) {
        case "DEAL_DAMAGE":
            return `Inflige ${params.amount ?? "?"} de daño ${TARGET_LABELS[params.target] || ""}.`;
        case "HEAL":
            return `Restaura ${params.amount ?? "?"} de vida ${TARGET_LABELS[params.target || "OWNER_HERO"] || ""}.`;
        case "DRAW_CARD": {
            const amount = params.amount || 1;
            const who = (!params.player || params.player === "OWNER") ? "" : " el rival";
            return amount > 1 ? `${who ? "El rival roba" : "Roba"} ${amount} cartas.` : `${who ? "El rival roba" : "Roba"} 1 carta.`;
        }
        case "GIVE_CHARGE":
            return "Puede atacar de inmediato.";
        case "RETURN_TO_HAND": {
            const amount = params.amount || 1;
            if (params.target === "ALL_MINIONS") {
                return `Devuelve ${TARGET_LABELS[params.target]} a la mano.`;
            }
            if (targetResolver.isManual(params.target)) {
                const who = { CHOOSE_ENEMY_MINIONS: "rival(es) ", CHOOSE_OWN_MINIONS: "tuyo(s) ", CHOOSE_ANY_MINIONS: "" }[params.target] || "";
                return `Elegís y devolvés ${amount} esbirro(s) ${who}a la mano.`;
            }
            const targetLabel = TARGET_LABELS[params.target || "ENEMY_MINIONS"] || "";
            return `Devuelve ${amount} esbirro(s) ${targetLabel.replace("a los ", "de los ").replace("a ", "de ")} a la mano.`;
        }
        default:
            return "";
    }
}

function describeAbilities(abilities) {
    if (!abilities || !abilities.length) return "";
    return abilities
        .map(a => `${TRIGGER_LABELS[a.trigger] || a.trigger}: ${describeEffect(a.effect, a.params)}`)
        .join(" ");
}

function allowDrop(e) { e.preventDefault(); if (state.activePlayer === 'player') document.getElementById('player-minions').classList.add('drag-over'); }
function dragLeave() { document.getElementById('player-minions').classList.remove('drag-over'); }

function drop(e) {
    e.preventDefault();
    document.getElementById('player-minions').classList.remove('drag-over');
    if (state.activePlayer !== 'player' || state.gameOver) return;
    if (state.pendingAbility) { log('Primero tenés que elegir el objetivo de la habilidad.'); return; }

    const cardId = e.dataTransfer.getData('text');
    const cardElement = document.getElementById(cardId);
    if (!cardElement) return;

    playCardFromElement(cardElement, 'player');
}

function playCardFromElement(cardElement, side) {
    const p = state[side];
    const manaCost = parseInt(cardElement.dataset.mana);
    if (p.mana < manaCost) { log('¡No tienes suficiente maná!'); return false; }

    if (cardElement.dataset.type === 'spell') {
        if (p.mana < manaCost) return false;
        p.mana -= manaCost;
        castSpell(cardElement.dataset.effect, parseInt(cardElement.dataset.value), side);
        p.handCount--;
        cardElement.remove();
        renderManaBar();
        return true;
    }

    if (p.minionCount >= CONFIG.MAX_MINIONS) { log(`El campo está lleno (máximo ${CONFIG.MAX_MINIONS}).`); return false; }
    p.mana -= manaCost;
    p.minionCount++;
    p.handCount--;

    const battlefieldId = side === 'player' ? 'player-minions' : 'enemy-minions';
    const battlefield = document.getElementById(battlefieldId);

    const keyword = cardElement.dataset.keyword || 'none';
    const charge = keyword === 'charge';

    const minion = document.createElement('div');
    minion.className = 'minion-in-play' + (charge ? '' : ' exhausted') + (keyword === 'taunt' ? ' taunt' : '');
    minion.id = side + '-minion-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    minion.dataset.side = side;
    minion.dataset.atk = cardElement.dataset.atk;
    minion.dataset.hp = cardElement.dataset.hp;
    minion.dataset.maxhp = cardElement.dataset.hp;
    minion.dataset.baseatk = cardElement.dataset.atk;
    minion.dataset.mana = cardElement.dataset.mana;
    minion.dataset.name = cardElement.dataset.name || '';

    minion.dataset.image = cardElement.dataset.image || '';
    minion.dataset.imagePosX = cardElement.dataset.imagePosX || 50;
    minion.dataset.imagePosY = cardElement.dataset.imagePosY || 50;
    minion.dataset.imageScale = cardElement.dataset.imageScale || 100;

    minion.dataset.keyword = keyword;
    minion.dataset.deathrattle = cardElement.dataset.deathrattle || '';
    const abilities = JSON.parse(cardElement.dataset.abilities || '[]');
    minion.dataset.abilities = JSON.stringify(abilities);

    minion.dataset.flavor = cardElement.dataset.flavor || '';
    minion.dataset.origin = cardElement.dataset.origin || '';
    minion.dataset.archetypes = cardElement.dataset.archetypes || '[]';
    minion.dataset.teams = cardElement.dataset.teams || '[]';

    const artInner = cardElement.dataset.image
        ? `<div class="minion-art-img" style="background-image: url('${cardElement.dataset.image}'); background-position: ${cardElement.dataset.imagePosX || 50}% ${cardElement.dataset.imagePosY || 50}%; transform: scale(${(cardElement.dataset.imageScale || 100) / 100}); transform-origin: ${cardElement.dataset.imagePosX || 50}% ${cardElement.dataset.imagePosY || 50}%;"></div>`
        : '';

    const kwTag = keyword !== 'none' ? `<div class="keyword-tag k-${keyword}">${keywordLabel(keyword)}</div>` : '';

    const archetypes = JSON.parse(minion.dataset.archetypes || '[]');
    const teams = JSON.parse(minion.dataset.teams || '[]');
    const originChip = minion.dataset.origin ? `<span class="chip origin">${minion.dataset.origin}</span>` : '';
    const archetypeChips = archetypes.map(a => `<span class="chip">${archetypeIconSvg(a)}${a}</span>`).join('');
    const teamChips = teams.map(a => `<span class="chip">${teamIconSvg(a)}${a}</span>`).join('');
    const abilitiesFullText = describeAbilities(abilities);

    minion.innerHTML = `
        <div class="minion-art">${artInner}</div>
        ${kwTag}
        <div class="atk-value">${cardElement.dataset.atk}</div>
        <div class="hp-value">${cardElement.dataset.hp}</div>

        <div class="expanded-panel minion-panel">
            <div class="exp-name">${minion.dataset.name || 'Esbirro'}</div>
            ${abilitiesFullText ? `<div class="exp-ability">${abilitiesFullText}</div>` : ''}
            ${(originChip || archetypeChips || teamChips) ? `<div class="exp-chips">${originChip}${archetypeChips}${teamChips}</div>` : ''}
            ${minion.dataset.flavor ? `<div class="exp-flavor">"${minion.dataset.flavor}"</div>` : ''}
        </div>
    `;

    if (side === 'player') minion.onclick = () => onPlayerMinionClick(minion);
    else minion.onclick = () => onEnemyMinionClick(minion);

    battlefield.appendChild(minion);

    const enemySide = side === 'player' ? 'enemy' : 'player';
    abilitySystem.registerCard(minion.id, abilities, {});
    eventBus.emit('ON_ENTER', { owner: side, enemySide, minionEl: minion });

    cardElement.remove();
    log(`${side === 'player' ? 'Invocaste' : 'El rival invoca'} ${cardElement.dataset.name ? `"${cardElement.dataset.name}"` : 'un esbirro'} ${minion.dataset.atk}/${minion.dataset.hp}${keyword !== 'none' ? ' (' + keywordLabel(keyword) + ')' : ''}.`);
    renderManaBar();
    return true;
}

function castSpell(effect, value, side) {
    const enemySide = side === 'player' ? 'enemy' : 'player';
    switch (effect) {
        case 'damage_enemy_hero':
            dealDamageToHero(enemySide, value);
            log(`${side === 'player' ? 'Lanzaste' : 'El rival lanza'} un hechizo: ${value} de daño directo.`);
            break;
        case 'heal_hero':
            healHero(side, value);
            log(`${side === 'player' ? 'Te curaste' : 'El rival se cura'} ${value} de vida.`);
            break;
        case 'draw_two':
            drawCard(side); drawCard(side);
            log(`${side === 'player' ? 'Robaste' : 'El rival roba'} 2 cartas.`);
            break;
        case 'damage_enemy_minion': {
            const row = document.getElementById(enemySide + '-minions');
            const minions = Array.from(row.children);
            if (minions.length === 0) { log('No había esbirros enemigos para el hechizo.'); break; }
            const target = pick(minions);
            damageMinion(target, value);
            log(`${side === 'player' ? 'Tu' : 'El'} hechizo golpea un esbirro enemigo por ${value}.`);
            break;
        }
    }
}

function dealDamageToHero(side, amount) {
    if (state.gameOver) return;
    state[side].hp = Math.max(0, state[side].hp - amount);
    const hpEl = document.getElementById(side + '-hp');
    hpEl.innerText = state[side].hp;
    hpEl.classList.add('hit');
    setTimeout(() => hpEl.classList.remove('hit'), 300);

    // Shake + viñeta roja en el avatar del héroe
    const avatar = document.getElementById(side + '-avatar');
    avatar.classList.remove('taking-damage', 'damage-flash');
    void avatar.offsetWidth; // forzar reflow para reiniciar la animación si ya corría
    avatar.classList.add('taking-damage', 'damage-flash');
    avatar.addEventListener('animationend', function handler() {
        avatar.removeEventListener('animationend', handler);
        avatar.classList.remove('taking-damage', 'damage-flash');
    }, { once: true });

    checkWinLose();
}

function healHero(side, amount) {
    const cap = CONFIG.STARTING_HP;
    state[side].hp = Math.min(cap, state[side].hp + amount);
    const hpEl = document.getElementById(side + '-hp');
    hpEl.innerText = state[side].hp;
    hpEl.classList.add('heal');
    setTimeout(() => hpEl.classList.remove('heal'), 300);
}

function damageMinion(minionEl, amount) {
    const newHp = parseInt(minionEl.dataset.hp) - amount;
    minionEl.dataset.hp = newHp;
    minionEl.querySelector('.hp-value').innerText = newHp;
    // Animación de daño recibido
    triggerTakeDamageAnim(minionEl);
    if (newHp <= 0) killMinion(minionEl);
}

function healMinion(minionEl, amount) {
    const maxHp = parseInt(minionEl.dataset.maxhp);
    const newHp = Math.min(maxHp, parseInt(minionEl.dataset.hp) + amount);
    minionEl.dataset.hp = newHp;
    minionEl.querySelector('.hp-value').innerText = newHp;
}

// ============================================================
// ANIMACIONES DE COMBATE
// ============================================================

/**
 * Calcula el vector de desplazamiento del atacante hacia el objetivo
 * y aplica la animación de "dash". Devuelve una Promise que se resuelve
 * cuando la animación termina.
 */
// Duración total de la animación de ataque en ms (debe coincidir con el CSS)
const ATTACK_ANIM_DURATION_MS = 650;
// Porcentaje de la animación en que el atacante toca al objetivo (keyframe 52%)
const ATTACK_IMPACT_PCT = 0.52;

function playAttackAnimation(attackerEl, targetEl) {
    return new Promise(resolve => {
        const aRect = attackerEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        const aCx = aRect.left + aRect.width  / 2;
        const aCy = aRect.top  + aRect.height / 2;
        const tCx = tRect.left + tRect.width  / 2;
        const tCy = tRect.top  + tRect.height / 2;

        const dashX = (tCx - aCx) * 0.85;
        const dashY = (tCy - aCy) * 0.85;

        attackerEl.style.setProperty('--dash-x', `${dashX}px`);
        attackerEl.style.setProperty('--dash-y', `${dashY}px`);

        attackerEl.classList.remove('attacking');
        void attackerEl.offsetWidth;
        attackerEl.classList.add('attacking');

        // Resolvemos en el momento del impacto para que el daño y el shake
        // ocurran justo cuando el atacante toca al objetivo, no al volver
        const impactDelay = ATTACK_ANIM_DURATION_MS * ATTACK_IMPACT_PCT;
        setTimeout(resolve, impactDelay);

        // Limpiamos la clase al terminar la animación completa (el rebote de vuelta)
        attackerEl.addEventListener('animationend', function handler() {
            attackerEl.removeEventListener('animationend', handler);
            attackerEl.classList.remove('attacking');
        }, { once: true });
    });
}

/**
 * Sacude el esbirro que recibe el golpe y le aplica un flash rojo.
 */
function triggerTakeDamageAnim(minionEl) {
    if (!minionEl || !document.body.contains(minionEl)) return;

    minionEl.classList.remove('taking-damage', 'damage-flash');
    void minionEl.offsetWidth;
    minionEl.classList.add('taking-damage', 'damage-flash');

    // El shake (taking-damage) dura 0.35s; la viñeta (::after via damage-flash) dura 0.45s.
    // Limpiamos ambas clases cuando termina la más larga.
    setTimeout(() => {
        minionEl.classList.remove('taking-damage', 'damage-flash');
    }, 460);
}

/**
 * Genera partículas que explotan desde el centro del esbirro muerto,
 * imita los fragmentos de carta de Hearthstone.
 */
function spawnDeathParticles(minionEl) {
    const rect = minionEl.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;

    // Colores para las partículas: dorado, naranja y blanco
    const colors = ['#f3d430', '#c3a05b', '#ff9900', '#fff8e1', '#ffffff', '#ff6600'];

    // Número de fragmentos
    const count = 14;

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'death-particle';

        // Tamaño variable
        const size = 6 + Math.random() * 8;
        // Ángulo y distancia de vuelo aleatorios
        const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.8;
        const dist  = 50 + Math.random() * 70;
        const flyX  = Math.cos(angle) * dist;
        const flyY  = Math.sin(angle) * dist;
        const spin  = (Math.random() * 720 - 360) + 'deg';
        const dur   = (0.4 + Math.random() * 0.35) + 's';
        const color = colors[Math.floor(Math.random() * colors.length)];

        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${cx - size / 2}px;
            top: ${cy - size / 2}px;
            position: fixed;
            --fly-x: ${flyX}px;
            --fly-y: ${flyY}px;
            --spin: ${spin};
            --dur: ${dur};
            --particle-color: ${color};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        `;

        document.body.appendChild(particle);

        // Limpiamos la partícula al terminar
        particle.addEventListener('animationend', () => particle.remove(), { once: true });
    }

    // Destello central
    const flash = document.createElement('div');
    flash.className = 'death-flash';
    flash.style.cssText = `
        width: ${rect.width}px;
        height: ${rect.height}px;
        left: ${rect.left}px;
        top: ${rect.top}px;
        position: fixed;
    `;
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove(), { once: true });
}

// ============================================================
// COMBATE — versiones con animaciones
// ============================================================

function killMinion(minionEl) {
    const side = minionEl.dataset.side;
    state[side].minionCount--;

    const enemySide = side === 'player' ? 'enemy' : 'player';
    eventBus.emit('ON_DEATH', { owner: side, enemySide, minionEl });
    abilitySystem.unregisterCard(minionEl.id);

    if (state.selectedAttacker === minionEl.id) clearSelection();

    // Disparamos las partículas antes de que empiece la animación de muerte
    spawnDeathParticles(minionEl);

    // Reemplazamos la clase dying original con la nueva animación
    minionEl.classList.add('dying');
    setTimeout(() => {
        if (document.body.contains(minionEl)) minionEl.remove();
    }, 500);
}

function returnMinionToHand(minionEl) {
    const side = minionEl.dataset.side;
    if (state[side].handCount >= CONFIG.MAX_HAND_SIZE) {
        log(`${side === 'player' ? 'Tu' : 'La'} mano está llena: no se pudo devolver un esbirro.`);
        return;
    }
    abilitySystem.unregisterCard(minionEl.id);
    state[side].minionCount--;

    const data = {
        type: 'minion',
        mana: parseInt(minionEl.dataset.mana || '0'),
        atk: parseInt(minionEl.dataset.baseatk ?? minionEl.dataset.atk),
        hp: parseInt(minionEl.dataset.maxhp),
        keyword: minionEl.dataset.keyword || 'none',
        name: minionEl.dataset.name || '',
        image: minionEl.dataset.image || '',
        imagePosX: parseInt(minionEl.dataset.imagePosX || 50),
        imagePosY: parseInt(minionEl.dataset.imagePosY || 50),
        imageScale: parseInt(minionEl.dataset.imageScale || 100),
        abilities: JSON.parse(minionEl.dataset.abilities || '[]'),
    };

    if (state.selectedAttacker === minionEl.id) clearSelection();
    minionEl.remove();
    addCardToHand(side, data);
}

function onPlayerMinionClick(minion) {
    if (handleAbilityTargetClick(minion)) return;
    if (state.activePlayer !== 'player' || state.gameOver) return;
    if (minion.classList.contains('exhausted')) { log('Ese esbirro tiene fatiga de invocación.'); return; }

    if (state.selectedAttacker === minion.id) { clearSelection(); return; }
    clearSelection();
    state.selectedAttacker = minion.id;
    minion.classList.add('selected');
    highlightTargets(true);
}

function enemyHasTaunt() {
    return Array.from(document.getElementById('enemy-minions').children).some(m => m.dataset.keyword === 'taunt');
}

function highlightTargets(on) {
    const tauntActive = on && enemyHasTaunt();
    const enemyAvatar = document.getElementById('enemy-avatar');
    enemyAvatar.classList.toggle('targetable', on && !tauntActive);
    enemyAvatar.classList.toggle('blocked', on && tauntActive);

    Array.from(document.getElementById('enemy-minions').children).forEach(m => {
        const isTaunt = m.dataset.keyword === 'taunt';
        m.classList.toggle('can-attack', on && (!tauntActive || isTaunt));
        m.classList.toggle('blocked-target', on && tauntActive && !isTaunt);
    });
}

function clearSelection() {
    if (state.selectedAttacker) {
        const prev = document.getElementById(state.selectedAttacker);
        if (prev) prev.classList.remove('selected');
    }
    state.selectedAttacker = null;
    highlightTargets(false);
}

// ============================================================
// Targeting manual de habilidades (grito de batalla / estertor)
// ------------------------------------------------------------
// Cuando una ability tiene un target "CHOOSE_*", en vez de resolverse
// sola (random) queda "pendiente": se resaltan los objetivos válidos
// y el efecto se aplica recién cuando el jugador hace click en uno.
// Si la carta la jugó la IA, no hay quién haga click, así que se
// resuelve sola (aleatoriamente) como antes.
// ============================================================

function requestManualTarget(targetType, context, onChosen) {
    const pool = targetResolver.resolveManualPool(targetType, context);
    const candidates = [...pool.minions, ...pool.heroes];
    if (!candidates.length) return; // no había nada válido para elegir, la habilidad no hace nada

    if (context.owner !== 'player') {
        // La IA no puede "elegir a mano": resuelve random entre los candidatos.
        const picked = pick(candidates);
        onChosen(typeof picked === 'string' ? picked : picked);
        return;
    }

    const validEls = [...pool.minions, ...pool.heroes.map(side => document.getElementById(side + '-avatar'))];
    beginTargetingMode(validEls, (el) => onChosen(resolveClickedTarget(el)), 'Elegí un objetivo para la habilidad.');
}

function requestManualMinionTargets(targetType, amount, context, onChosen) {
    const pool = targetResolver.resolveManualPool(targetType, context);
    const candidates = pool.minions;
    if (!candidates.length) return;

    if (context.owner !== 'player') {
        const chosen = shuffle(candidates.slice()).slice(0, amount);
        onChosen(chosen);
        return;
    }

    beginMultiTargetingMode(candidates, amount, onChosen, `Elegí ${amount} esbirro(s) para la habilidad.`);
}

function resolveClickedTarget(el) {
    if (el.id === 'player-avatar') return 'player';
    if (el.id === 'enemy-avatar') return 'enemy';
    return el;
}

function beginTargetingMode(validEls, onComplete, promptMsg) {
    clearSelection(); // cancelamos cualquier selección de ataque en curso
    state.pendingAbility = {
        multi: false,
        needed: 1,
        chosen: [],
        validEls,
        onComplete: (el) => { endTargetingMode(); onComplete(el); },
    };
    validEls.forEach(el => el && el.classList.add('ability-targetable'));
    document.getElementById('end-turn').disabled = true;
    log(promptMsg);
}

function beginMultiTargetingMode(validEls, amount, onComplete, promptMsg) {
    clearSelection();
    state.pendingAbility = {
        multi: true,
        needed: Math.min(amount, validEls.length),
        chosen: [],
        validEls,
        onComplete: (chosen) => { endTargetingMode(); onComplete(chosen); },
    };
    validEls.forEach(el => el && el.classList.add('ability-targetable'));
    document.getElementById('end-turn').disabled = true;
    log(promptMsg);
}

function endTargetingMode() {
    if (!state.pendingAbility) return;
    state.pendingAbility.validEls.forEach(el => el && el.classList.remove('ability-targetable', 'ability-chosen'));
    state.pendingAbility = null;
    if (state.activePlayer === 'player' && !state.gameOver) {
        document.getElementById('end-turn').disabled = false;
    }
}

// Se llama al principio de cualquier click sobre esbirro/héroe. Si hay
// una habilidad esperando target, absorbe el click y devuelve true
// (para que el handler normal de ataque/etc. no siga procesando).
function handleAbilityTargetClick(el) {
    const pending = state.pendingAbility;
    if (!pending) return false;
    if (!pending.validEls.includes(el)) return true; // click fuera de los objetivos válidos: se ignora

    if (!pending.multi) {
        pending.onComplete(el);
        return true;
    }

    if (!pending.chosen.includes(el)) {
        pending.chosen.push(el);
        el.classList.add('ability-chosen');
    }
    if (pending.chosen.length >= pending.needed) {
        pending.onComplete(pending.chosen.slice());
    }
    return true;
}

function onEnemyMinionClick(target) {
    if (handleAbilityTargetClick(target)) return;
    if (!state.selectedAttacker || state.activePlayer !== 'player') return;
    if (enemyHasTaunt() && target.dataset.keyword !== 'taunt') { log('¡Debes atacar a un esbirro con Provocar primero!'); return; }
    const attacker = document.getElementById(state.selectedAttacker);
    if (!attacker) return;
    resolveMinionCombat(attacker, target);
    clearSelection();
}

document.getElementById('enemy-avatar').addEventListener('click', () => {
    const el = document.getElementById('enemy-avatar');
    if (handleAbilityTargetClick(el)) return;
    if (!state.selectedAttacker || state.activePlayer !== 'player' || state.gameOver) return;
    if (enemyHasTaunt()) { log('¡Debes atacar a un esbirro con Provocar primero!'); return; }
    const attacker = document.getElementById(state.selectedAttacker);
    if (!attacker) return;
    resolveHeroAttack(attacker, 'enemy');
    clearSelection();
});

// El propio avatar no tiene otro uso hoy (no te podés atacar a vos mismo),
// pero necesita un listener para poder ser objetivo de una habilidad tipo
// CHOOSE_ANY_OWN (ej. un daño/curación que el jugador puede tirarse a sí mismo).
document.getElementById('player-avatar').addEventListener('click', () => {
    handleAbilityTargetClick(document.getElementById('player-avatar'));
});

function resolveHeroAttack(attackerEl, targetSide) {
    const dmg = parseInt(attackerEl.dataset.atk);
    const targetEl = document.getElementById(targetSide + '-avatar');

    // Animación de ataque y luego aplicamos el daño
    playAttackAnimation(attackerEl, targetEl).then(() => {
        dealDamageToHero(targetSide, dmg);
        if (attackerEl.dataset.keyword === 'lifesteal') healHero(attackerEl.dataset.side, dmg);
    });

    attackerEl.classList.add('exhausted');
    log(`${attackerEl.dataset.side === 'player' ? 'Atacaste' : 'El rival ataca'} al héroe ${targetSide === 'player' ? 'propio' : 'rival'} por ${dmg}.`);
}

function resolveMinionCombat(attackerEl, defenderEl) {
    const atkDmg = parseInt(attackerEl.dataset.atk);
    const defDmg = parseInt(defenderEl.dataset.atk);

    // Iniciamos la animación del atacante hacia el defensor
    playAttackAnimation(attackerEl, defenderEl).then(() => {
        // Aplicamos el daño solo después de que el dash llega al objetivo
        damageMinion(defenderEl, atkDmg);
        if (document.body.contains(attackerEl) && !attackerEl.classList.contains('dying')) {
            damageMinion(attackerEl, defDmg);
        }
        if (attackerEl.dataset.keyword === 'lifesteal') healHero(attackerEl.dataset.side, atkDmg);
        if (defenderEl.dataset.keyword === 'lifesteal' && document.body.contains(defenderEl)) {
            healHero(defenderEl.dataset.side, defDmg);
        }
    });

    attackerEl.classList.add('exhausted');
    log(`Combate de esbirros: ${atkDmg} vs ${defDmg} de daño intercambiado.`);
}

function checkWinLose() {
    if (state.gameOver) return;
    if (state.enemy.hp <= 0) { state.gameOver = true; showOverlay('¡GANASTE! 🎉'); log('¡Victoria!'); disableAll(); }
    else if (state.player.hp <= 0) { state.gameOver = true; showOverlay('DERROTA'); log('Has sido derrotado...'); disableAll(); }
}

function disableAll() {
    document.getElementById('end-turn').disabled = true;
    document.querySelectorAll('.card, .minion-in-play, #deck').forEach(el => el.style.pointerEvents = 'none');
    highlightTargets(false);
}

function useHeroPower() {
    if (state.activePlayer !== 'player' || state.gameOver) return;
    if (state.pendingAbility) { log('Primero tenés que elegir el objetivo de la habilidad.'); return; }
    const btn = document.getElementById('player-power');
    if (state.player.heroPowerUsed) { log('Ya usaste tu poder de héroe este turno.'); return; }
    if (state.player.mana < 2) { log('Necesitas 2 de maná para tu poder de héroe.'); return; }
    state.player.mana -= 2;
    state.player.heroPowerUsed = true;
    btn.classList.add('used');
    dealDamageToHero('enemy', 2);
    renderManaBar();
    log('Usaste tu poder de héroe: 2 de daño al rival.');
}

function startPlayerTurn() {
    if (state.gameOver) return;
    state.activePlayer = 'player';
    state.turn++;
    state.player.maxMana = Math.min(CONFIG.MAX_MANA, state.player.maxMana + 1);
    state.player.mana = state.player.maxMana;
    state.player.heroPowerUsed = false;
    document.getElementById('player-power').classList.remove('used');
    document.querySelectorAll('#player-minions .minion-in-play').forEach(m => m.classList.remove('exhausted'));
    renderManaBar();
    drawCard('player');
    document.getElementById('turn-indicator').innerText = `TURNO ${state.turn} - TU TURNO`;
    document.getElementById('end-turn').disabled = false;
    log(`--- Turno ${state.turn}: tu turno ---`);
}

function endPlayerTurn() {
    if (state.activePlayer !== 'player' || state.gameOver) return;
    if (state.pendingAbility) { log('Primero tenés que elegir el objetivo de la habilidad.'); return; }
    clearSelection();
    document.getElementById('end-turn').disabled = true;
    state.activePlayer = 'enemy';
    document.getElementById('turn-indicator').innerText = `TURNO ${state.turn} - RIVAL PENSANDO...`;
    renderManaBar();
    setTimeout(runEnemyTurn, 700);
}

function runEnemyTurn() {
    if (state.gameOver) return;
    state.enemy.maxMana = Math.min(CONFIG.MAX_MANA, state.enemy.maxMana + 1);
    state.enemy.mana = state.enemy.maxMana;
    state.enemy.heroPowerUsed = false;
    document.querySelectorAll('#enemy-minions .minion-in-play').forEach(m => m.classList.remove('exhausted'));
    drawCard('enemy');
    renderManaBar();
    log(`--- Turno ${state.turn}: turno del rival ---`);

    aiPlayCards();
    setTimeout(() => {
        aiUseHeroPowerMaybe();
        setTimeout(() => {
            aiAttackPhase();
            setTimeout(() => {
                if (!state.gameOver) startPlayerTurn();
            }, 500);
        }, 500);
    }, 500);
}

function aiPlayCards() {
    state.enemy.hand.sort((a, b) => b.mana - a.mana);
    let playedSomething = true;
    while (playedSomething) {
        playedSomething = false;
        for (let i = 0; i < state.enemy.hand.length; i++) {
            const data = state.enemy.hand[i];
            if (data.mana > state.enemy.mana) continue;
            if (data.type === 'minion' && state.enemy.minionCount >= CONFIG.MAX_MINIONS) continue;

            const tempCard = buildTempCardElement(data);
            const success = playCardFromElement(tempCard, 'enemy');
            if (success) {
                state.enemy.hand.splice(i, 1);
                const backEl = document.getElementById('back-' + data.id);
                if (backEl) backEl.remove();
                refreshEnemyHandFan();
                playedSomething = true;
                break;
            }
        }
    }
}

function buildTempCardElement(data) {
    const el = document.createElement('div');
    el.dataset.mana = data.mana;
    el.dataset.type = data.type;
    if (data.type === 'minion') {
        el.dataset.atk = data.atk;
        el.dataset.hp = data.hp;
        el.dataset.keyword = data.keyword;
        el.dataset.battlecry = data.battlecry || '';
        el.dataset.deathrattle = data.deathrattle || '';
        el.dataset.abilities = JSON.stringify(cardAbilities(data));
        el.dataset.image = data.image || '';
        el.dataset.imagePosX = data.imagePosX || 50;
        el.dataset.imagePosY = data.imagePosY || 50;
        el.dataset.imageScale = data.imageScale || 100;
        el.dataset.name = data.name || '';
        el.dataset.flavor = data.flavor || '';
        el.dataset.origin = data.origin || '';
        el.dataset.archetypes = JSON.stringify(data.archetypes || []);
        el.dataset.teams = JSON.stringify(data.teams || []);
    } else {
        el.dataset.effect = data.effect;
        el.dataset.value = data.value;
    }
    return el;
}

function aiUseHeroPowerMaybe() {
    if (state.gameOver) return;
    if (state.enemy.heroPowerUsed || state.enemy.mana < 2) return;
    if (state.enemy.mana >= 2) {
        state.enemy.mana -= 2;
        state.enemy.heroPowerUsed = true;
        dealDamageToHero('player', 2);
        renderManaBar();
        log('El rival usa su poder de héroe: 2 de daño.');
    }
}

function aiAttackPhase() {
    if (state.gameOver) return;
    const attackers = Array.from(document.getElementById('enemy-minions').children).filter(m => !m.classList.contains('exhausted'));
    const playerTaunts = Array.from(document.getElementById('player-minions').children).filter(m => m.dataset.keyword === 'taunt');

    attackers.forEach(attacker => {
        if (!document.body.contains(attacker) || state.gameOver) return;
        const playerMinions = Array.from(document.getElementById('player-minions').children);

        if (playerTaunts.length > 0) {
            const target = playerTaunts.reduce((a, b) => parseInt(a.dataset.hp) < parseInt(b.dataset.hp) ? a : b);
            resolveMinionCombat(attacker, target);
            return;
        }

        const atk = parseInt(attacker.dataset.atk);
        const hp = parseInt(attacker.dataset.hp);
        const favorable = playerMinions.find(m => parseInt(m.dataset.hp) <= atk && parseInt(m.dataset.atk) < hp);
        if (favorable) {
            resolveMinionCombat(attacker, favorable);
            return;
        }

        resolveHeroAttack(attacker, 'player');
    });
}

(async function init() {
    renderInitialStats();
    renderManaBar();
    document.getElementById('end-turn').disabled = false;
    await Promise.all([loadPlayerDeck(), loadEnemyDeck()]);
    document.getElementById('loading-msg').style.display = 'none';
    for (let i = 0; i < 3; i++) setTimeout(() => drawCard('player'), i * 200);
    for (let i = 0; i < 3; i++) setTimeout(() => drawCard('enemy'), i * 200);
    log('¡Comienza la partida! Turno 1 - tu turno.');
})();

async function reportGameResult(result) {
    if (!DECK_ID || !AUTH_TOKEN) return; // partida suelta sin mazo/usuario: no hay nada que reportar
    try {
        const res = await fetch(`${API_BASE}/game/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ deck_id: DECK_ID, result }),
        });
        if (res.ok) {
            const data = await res.json();
            if (data.pack_awarded) log('¡Ganaste un sobre! Volvé al menú para abrirlo.');
        }
    } catch (err) {
        console.warn('No se pudo reportar el resultado de la partida.', err);
    }
}

function checkWinLose() {
    if (state.gameOver) return;
    if (state.enemy.hp <= 0) {
        state.gameOver = true;
        showOverlay('¡GANASTE! 🎉');
        log('¡Victoria!');
        disableAll();
        reportGameResult('win');
    } else if (state.player.hp <= 0) {
        state.gameOver = true;
        showOverlay('DERROTA');
        log('Has sido derrotado...');
        disableAll();
        reportGameResult('lose');
    }
}
