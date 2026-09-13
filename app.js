import { createEngine } from "./engine/index.js";

const ROUNDS = ["ottavi", "quarti", "semifinale", "finale"];
const ROUND_LABELS = {
  ottavi: "Ottavi di finale",
  quarti: "Quarti di finale",
  semifinale: "Semifinale",
  finale: "Finale",
};
const SETS_TO_WIN = { Bo3: 2, Bo5: 3 };
const STAT_LABELS = {
  ace_pct: "% ace",
  first_in_pct: "% prime in campo",
  first_won_pct: "% punti vinti su prima",
  second_won_pct: "% punti vinti su seconda",
  bp_saved_pct: "% palle break salvate",
  service_games_won_pct: "% game al servizio vinti",
  return_first_won_pct: "% punti vinti in risposta su prima",
  return_second_won_pct: "% punti vinti in risposta su seconda",
  bp_converted_pct: "% palle break convertite",
  return_games_won_pct: "% game in risposta vinti",
  tiebreaks_won_pct: "% tie-break vinti",
  deciding_set_won_pct: "% partite vinte al set decisivo",
};

const root = document.getElementById("app");

/** @type {any} */
let state = null;
let playersData = null;
let engine = null;

function randomOpponent(excludeIds, excludePlayerIds) {
  const pool = playersData.players.filter((p) => !excludeIds.has(p.id) && !excludePlayerIds.has(p.player_id));
  return pool[Math.floor(Math.random() * pool.length)];
}

function newTournamentState(format, playerCard) {
  const facedPlayerIds = new Set([playerCard.player_id]);
  const opponent = randomOpponent(new Set([playerCard.id]), facedPlayerIds);
  facedPlayerIds.add(opponent.player_id);

  return {
    screen: "vs-intro",
    format,
    playerCard,
    roundIndex: 0,
    opponent,
    facedIds: new Set([playerCard.id, opponent.id]),
    facedPlayerIds,
    usedCategories: new Set(),
    playerSets: 0,
    opponentSets: 0,
    currentOptions: [],
    lastReveal: null,
    history: [], // { round, opponent, sets: [{score, comment, categoryKey, categoryLabel, won}], result }
    matchSets: [], // sets played in the current match, same shape as above
  };
}

function currentRound() {
  return ROUNDS[state.roundIndex];
}

function startSet() {
  state.currentOptions = engine.getCategoryOptions(
    state.playerCard,
    state.opponent,
    currentRound(),
    state.usedCategories,
    3,
  );
  state.screen = "match";
}

function chooseCategory(categoryKey) {
  const outcome = engine.resolveChoice(state.playerCard, state.opponent, categoryKey);
  state.usedCategories.add(categoryKey);
  if (outcome.won) state.playerSets++;
  else state.opponentSets++;

  const setRecord = { ...outcome };
  state.matchSets.push(setRecord);
  state.lastReveal = setRecord;
  state.screen = "reveal";
}

function afterReveal() {
  const toWin = SETS_TO_WIN[state.format];
  const matchOver = state.playerSets === toWin || state.opponentSets === toWin;

  if (!matchOver) {
    startSet();
    return;
  }

  const wonMatch = state.playerSets === toWin;
  state.history.push({
    round: currentRound(),
    opponent: state.opponent,
    sets: state.matchSets,
    result: wonMatch ? "vinto" : "perso",
  });

  if (!wonMatch) {
    state.screen = "final";
    state.eliminated = true;
    return;
  }

  if (state.roundIndex === ROUNDS.length - 1) {
    state.screen = "final";
    state.eliminated = false;
    return;
  }

  // Next round: draw a new opponent, reset per-match state.
  state.roundIndex++;
  state.playerSets = 0;
  state.opponentSets = 0;
  state.usedCategories = new Set();
  state.matchSets = [];
  state.opponent = randomOpponent(state.facedIds, state.facedPlayerIds);
  state.facedIds.add(state.opponent.id);
  state.facedPlayerIds.add(state.opponent.player_id);
  state.screen = "vs-intro";
}

function renderSetup() {
  const sorted = playersData.players
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name) || a.year - b.year);

  const formatButtons = ["Bo3", "Bo5"]
    .map(
      (f) => `
      <button class="option-btn ${state.pickedFormat === f ? "selected" : ""}" data-action="pick-format" data-format="${f}">
        ${f === "Bo3" ? "Al meglio dei 3 set" : "Al meglio dei 5 set"}
      </button>`,
    )
    .join("");

  const playerButtons = sorted
    .map(
      (p) => `
      <button class="player-btn ${state.pickedPlayerId === p.id ? "selected" : ""}" data-action="pick-player" data-id="${p.id}">
        ${p.name} <span class="year-tag">${p.year}</span>
      </button>`,
    )
    .join("");

  const canStart = state.pickedFormat && state.pickedPlayerId;

  root.innerHTML = `
    <header class="app-header">
      <h1>Tennis Storico</h1>
      <p class="tagline">Coach di una carriera</p>
    </header>
    <section class="setup">
      <h2>1. Formato del torneo</h2>
      <div class="option-row">${formatButtons}</div>

      <h2>2. Scegli il tuo giocatore-anno</h2>
      <p class="hint">Le statistiche restano coperte per tutto il torneo: le scoprirai solo dal modo in cui vinci o perdi i set.</p>
      <div class="player-grid">${playerButtons}</div>

      <button class="primary-btn" data-action="start-tournament" ${canStart ? "" : "disabled"}>
        Inizia il torneo
      </button>
    </section>
  `;
}

function renderLadder() {
  return `
    <div class="ladder">
      ${ROUNDS.map((r, i) => {
        let cls = "ladder-step";
        if (i < state.roundIndex) cls += " done";
        else if (i === state.roundIndex) cls += " active";
        return `<div class="${cls}">${ROUND_LABELS[r]}</div>`;
      }).join("")}
    </div>
  `;
}

function renderVsIntro() {
  root.innerHTML = `
    <header class="app-header compact">
      <h1>Tennis Storico</h1>
    </header>
    ${renderLadder()}
    <section class="vs-intro">
      <h2>${ROUND_LABELS[currentRound()]}</h2>
      <div class="vs-card">
        <div class="vs-side">${state.playerCard.name} <span class="year-tag">${state.playerCard.year}</span></div>
        <div class="vs-sep">vs</div>
        <div class="vs-side">${state.opponent.name} <span class="year-tag">${state.opponent.year}</span></div>
      </div>
      <button class="primary-btn" data-action="play-set">Gioca il primo set</button>
    </section>
  `;
}

function renderMatch() {
  const optionButtons = state.currentOptions
    .map((opt) => `<button class="tactic-btn" data-action="choose-category" data-key="${opt.key}">${opt.label}</button>`)
    .join("");

  root.innerHTML = `
    <header class="app-header compact">
      <h1>Tennis Storico</h1>
    </header>
    ${renderLadder()}
    <section class="match">
      <h2>${ROUND_LABELS[currentRound()]}</h2>
      <div class="score-tally">
        ${state.playerCard.name} ${state.playerSets} — ${state.opponentSets} ${state.opponent.name}
      </div>
      <p class="hint">Scegli la tua lente tattica per questo set:</p>
      <div class="tactic-row">${optionButtons}</div>
    </section>
  `;
}

function renderReveal() {
  const r = state.lastReveal;
  const resultClass = r.won ? "won" : "lost";
  root.innerHTML = `
    <header class="app-header compact">
      <h1>Tennis Storico</h1>
    </header>
    ${renderLadder()}
    <section class="reveal">
      <div class="reveal-score ${resultClass}">${r.score}</div>
      <p class="reveal-comment">${r.comment}</p>
      <div class="score-tally">
        ${state.playerCard.name} ${state.playerSets} — ${state.opponentSets} ${state.opponent.name}
      </div>
      <button class="primary-btn" data-action="after-reveal">Continua</button>
    </section>
  `;
}

function statRow(key, playerVal, opponentVal, usedKeys) {
  const used = usedKeys.has(key) ? "used-stat" : "";
  const fmt = (v) => (v == null ? "—" : `${v}%`);
  return `<tr class="${used}"><td>${STAT_LABELS[key]}</td><td>${fmt(playerVal)}</td><td>${fmt(opponentVal)}</td></tr>`;
}

function renderMatchStatsTable(matchRecord) {
  const usedKeys = new Set(matchRecord.sets.map((s) => s.categoryKey));
  const rows = engine.statKeys
    .map((key) => statRow(key, state.playerCard.stats[key], matchRecord.opponent.stats[key], usedKeys))
    .join("");

  return `
    <table class="stats-table">
      <thead><tr><th>Statistica</th><th>${state.playerCard.name}</th><th>${matchRecord.opponent.name}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderFinal() {
  const title = state.eliminated
    ? `Eliminato — ${ROUND_LABELS[currentRound()]}`
    : "Campione del torneo!";

  const roundsHtml = state.history
    .map((h) => {
      const setsHtml = h.sets
        .map((s) => `<li>${s.categoryLabel}: <strong>${s.score}</strong> — ${s.comment}</li>`)
        .join("");
      return `
        <article class="round-recap">
          <h3>${ROUND_LABELS[h.round]} vs ${h.opponent.name} <span class="year-tag">${h.opponent.year}</span> — ${h.result}</h3>
          <ul class="set-list">${setsHtml}</ul>
          ${renderMatchStatsTable(h)}
        </article>
      `;
    })
    .join("");

  root.innerHTML = `
    <header class="app-header compact">
      <h1>Tennis Storico</h1>
    </header>
    <section class="final">
      <h2>${title}</h2>
      <p class="hint">Ecco la pagella: tutte le statistiche vere dei match giocati, finalmente svelate.</p>
      ${roundsHtml}
      <button class="primary-btn" data-action="restart">Nuovo torneo</button>
    </section>
  `;
}

function render() {
  if (!playersData) {
    root.innerHTML = "<p>Caricamento...</p>";
    return;
  }
  if (state.screen === "setup") return renderSetup();
  if (state.screen === "vs-intro") return renderVsIntro();
  if (state.screen === "match") return renderMatch();
  if (state.screen === "reveal") return renderReveal();
  if (state.screen === "final") return renderFinal();
}

function resetToSetup() {
  state = { screen: "setup", pickedFormat: null, pickedPlayerId: null };
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "pick-format") {
    state.pickedFormat = target.dataset.format;
  } else if (action === "pick-player") {
    state.pickedPlayerId = target.dataset.id;
  } else if (action === "start-tournament") {
    const playerCard = playersData.players.find((p) => p.id === state.pickedPlayerId);
    state = newTournamentState(state.pickedFormat, playerCard);
  } else if (action === "play-set") {
    startSet();
  } else if (action === "choose-category") {
    chooseCategory(target.dataset.key);
  } else if (action === "after-reveal") {
    afterReveal();
  } else if (action === "restart") {
    resetToSetup();
  }

  render();
});

async function init() {
  resetToSetup();
  render();
  const response = await fetch("./data/players.json");
  playersData = await response.json();
  engine = createEngine(playersData);
  render();
}

init();
