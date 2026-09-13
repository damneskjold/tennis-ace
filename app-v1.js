import { createEngine, newWallet, rest } from "./engine/v1/index.js";
import { flagFor } from "./flags.js";

const ROUNDS = ["ottavi", "quarti", "semifinale", "finale"];
const ROUND_LABELS = { ottavi: "Ottavi", quarti: "Quarti", semifinale: "Semifinale", finale: "Finale" };
const SETS_TO_WIN = { Bo3: 2, Bo5: 3 };
const PLAYER_DRAW_MS = 2300;
const OPPONENT_DRAW_MS = 1200;

const root = document.getElementById("app");

let state = null;
let playersData = null;
let engine = null;

const cardName = (card) => `${flagFor(card.country)} ${card.name}`.trim();
const surname = (card) => card.name.split(" ").slice(1).join(" ") || card.name;
const shortCardName = (card) => `${flagFor(card.country)} ${surname(card)}`.trim();
const starGlyph = (n) => "★".repeat(n) + "☆".repeat(5 - n);

// --- slot-machine draw, same mechanic as v0's app.js: the result is decided
// before the animation starts, the spinning is theatre.
let animationToken = 0;

function slotCardHtml(card, landed) {
  return `<div class="slot-card ${landed ? "landed" : ""}">
      <div class="slot-flag">${flagFor(card.country) || "🎾"}</div>
      <div class="slot-name">${card.name}</div>
      <div class="slot-year">${card.year}</div>
    </div>`;
}

function spinTo(slotId, finalCard, durationMs, onDone) {
  const token = ++animationToken;
  const el = document.getElementById(slotId);
  if (!el) return;

  const settle = () => {
    el.innerHTML = slotCardHtml(finalCard, true);
    onDone();
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    settle();
    return;
  }

  const pool = playersData.players;
  const start = performance.now();
  let lastSwap = 0;

  function frame(now) {
    if (token !== animationToken || !el.isConnected) return;
    const t = Math.min(1, (now - start) / durationMs);
    const interval = 45 + 400 * t ** 3;
    if (now - lastSwap >= interval) {
      lastSwap = now;
      el.innerHTML = slotCardHtml(pool[Math.floor(Math.random() * pool.length)], false);
    }
    if (t < 1) requestAnimationFrame(frame);
    else settle();
  }
  requestAnimationFrame(frame);
}

function randomCard() {
  return playersData.players[Math.floor(Math.random() * playersData.players.length)];
}

function randomOpponent(excludeIds, excludePlayerIds) {
  const pool = playersData.players.filter((p) => !excludeIds.has(p.id) && !excludePlayerIds.has(p.player_id));
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- tournament state -------------------------------------------------

function newTournamentState(format, playerCard) {
  const facedPlayerIds = new Set([playerCard.player_id]);
  const opponent = randomOpponent(new Set([playerCard.id]), facedPlayerIds);
  facedPlayerIds.add(opponent.player_id);

  return {
    screen: "vs-intro",
    format,
    playerCard,
    opponent,
    opponentRevealed: false,
    roundIndex: 0,
    facedIds: new Set([playerCard.id, opponent.id]),
    facedPlayerIds,
    wallet: newWallet(),
    playerSets: 0,
    opponentSets: 0,
    matchSets: [],
    lastReveal: null,
    history: [],
  };
}

const currentRound = () => ROUNDS[state.roundIndex];

function chooseCard(cardKey) {
  const outcome = engine.play(state.wallet, state.playerCard, state.opponent, cardKey);
  state.wallet = outcome.wallet;
  if (outcome.won) state.playerSets++;
  else state.opponentSets++;
  state.matchSets.push(outcome);
  state.lastReveal = outcome;
  state.screen = "reveal";
}

function afterReveal() {
  const toWin = SETS_TO_WIN[state.format];
  const matchOver = state.playerSets === toWin || state.opponentSets === toWin;

  if (!matchOver) {
    state.screen = "match";
    return;
  }

  const wonMatch = state.playerSets === toWin;
  state.history.push({
    round: currentRound(),
    opponent: state.opponent,
    sets: state.matchSets,
    result: wonMatch ? "vinto" : "perso",
  });

  if (!wonMatch || state.roundIndex === ROUNDS.length - 1) {
    state.eliminated = !wonMatch;
    state.screen = "final";
    return;
  }

  state.roundIndex++;
  state.playerSets = 0;
  state.opponentSets = 0;
  state.matchSets = [];
  state.wallet = rest(state.wallet);
  state.opponent = randomOpponent(state.facedIds, state.facedPlayerIds);
  state.facedIds.add(state.opponent.id);
  state.facedPlayerIds.add(state.opponent.player_id);
  state.opponentRevealed = false;
  state.screen = "vs-intro";
}

// --- rendering ----------------------------------------------------------

function renderSetup() {
  root.innerHTML = `
    <header class="app-header">
      <h1>Blind Coach</h1>
      <p class="tagline">v1 — le tue carte, l'avversario di traverso</p>
    </header>
    <section class="panel setup">
      <h2>Formato</h2>
      <div class="option-row">
        ${["Bo3", "Bo5"]
          .map(
            (f) => `<button class="option-btn ${state.pickedFormat === f ? "selected" : ""}"
              data-action="pick-format" data-format="${f}">${f === "Bo3" ? "3 set" : "5 set"}</button>`,
          )
          .join("")}
      </div>
      <p class="hint">
        ${playersData.players.length} stagioni reali dal 1991 al 2025. Vedrai le tue statistiche fin dal
        primo set — dell'avversario conoscerai solo un Overall e delle stelline per categoria, mai il numero.
        Ogni carta che giochi ti costa crediti: più forte è per te, più costa.
      </p>
      <button class="primary-btn draw-btn" data-action="draw-player">Estrai il tuo giocatore</button>
    </section>
  `;
}

function renderDraw() {
  root.innerHTML = `
    <header class="app-header compact"><h1>Blind Coach</h1></header>
    <section class="panel draw-screen">
      <p class="draw-label">${state.drawComplete ? "Allenerai" : "Estrazione in corso…"}</p>
      <div id="draw-slot" class="slot">${slotCardHtml(state.playerCard, state.drawComplete)}</div>
      <button class="primary-btn" data-action="start-tournament" ${state.drawComplete ? "" : "hidden"}>
        Porta ${surname(state.playerCard)} al titolo
      </button>
    </section>
  `;

  if (!state.drawComplete) {
    spinTo("draw-slot", state.playerCard, PLAYER_DRAW_MS, () => {
      state.drawComplete = true;
      const button = root.querySelector('[data-action="start-tournament"]');
      if (button) button.hidden = false;
      const label = root.querySelector(".draw-label");
      if (label) label.textContent = "Allenerai";
    });
  }
}

function renderBracket() {
  return `
    <div class="bracket">
      ${ROUNDS.map((round, i) => {
        const played = state.history.find((h) => h.round === round);
        let cls = "bracket-round";
        let detail;
        if (played) {
          cls += played.result === "vinto" ? " won" : " lost";
          detail = `<span class="bracket-opp">${shortCardName(played.opponent)}</span>`;
        } else if (i === state.roundIndex) {
          cls += " active";
          detail = state.opponentRevealed
            ? `<span class="bracket-opp">${shortCardName(state.opponent)}</span>`
            : `<span class="bracket-opp muted">estrazione…</span>`;
        } else {
          detail = `<span class="bracket-opp muted">—</span>`;
        }
        return `<div class="${cls}"><span class="bracket-label">${ROUND_LABELS[round]}</span>${detail}</div>`;
      }).join("")}
    </div>
  `;
}

function renderWalletBar() {
  const w = state.wallet;
  const pct = Math.max(0, Math.min(100, w.budget));
  const cls = w.budget <= 25 ? "critical" : w.budget <= 55 ? "low" : "";
  return `
    <div class="wallet-bar">
      <div class="wallet-label">
        <span>Crediti</span><span class="wallet-value">${w.budget}</span>
      </div>
      <div class="wallet-track"><div class="wallet-fill ${cls}" style="width:${pct}%"></div></div>
    </div>
  `;
}

function renderScoreboard() {
  const toWin = SETS_TO_WIN[state.format];
  const pips = (n) =>
    Array.from({ length: toWin }, (_, i) => `<span class="pip ${i < n ? "filled" : ""}"></span>`).join("");
  return `
    <div class="scoreboard">
      <div class="sb-side">
        <span class="sb-name">${shortCardName(state.playerCard)}</span>
        <span class="pips">${pips(state.playerSets)}</span>
      </div>
      <div class="sb-side right">
        <span class="pips">${pips(state.opponentSets)}</span>
        <span class="sb-name">${shortCardName(state.opponent)}</span>
      </div>
    </div>
  `;
}

function renderVsIntro() {
  const p = state.playerCard;
  return `
    ${renderBracket()}
    <section class="panel vs-intro">
      <h2>${ROUND_LABELS[currentRound()]}</h2>
      <div class="vs-card">
        <div class="vs-side">
          <div class="slot-card landed compact-slot">
            <div class="slot-flag">${flagFor(p.country) || "🎾"}</div>
            <div class="slot-name">${p.name}</div>
            <div class="year-tag">${p.year}</div>
          </div>
          <div class="overall-badge mine">${p.overall}</div>
        </div>
        <div class="vs-sep">vs</div>
        <div class="vs-side">
          <div id="opp-slot" class="slot compact">${slotCardHtml(state.opponent, state.opponentRevealed)}</div>
          ${state.opponentRevealed ? `<div class="overall-badge theirs">${state.opponent.overall}</div>` : ""}
        </div>
      </div>
      ${state.opponentRevealed ? renderScoutPreview() : ""}
      <button class="primary-btn" data-action="play-set" ${state.opponentRevealed ? "" : "hidden"}>
        Gioca il primo set
      </button>
    </section>
  `;
}

function renderScoutPreview() {
  const cards = engine.scoutOpponent(state.opponent).cards;
  return `
    <div class="scout-preview">
      <p class="hint">Quello che sai di lui — mai il numero, solo le stelline:</p>
      <div class="scout-grid">
        ${cards
          .map((c) => `<div class="scout-row"><span>${c.label}</span><span class="stars">${starGlyph(c.stars)}</span></div>`)
          .join("")}
      </div>
    </div>
  `;
}

function renderMatch() {
  const { cards, costs } = engine.ownProfile(state.playerCard);
  const options = engine.options(state.wallet, state.playerCard, costs);
  const optionByCard = Object.fromEntries(options.map((o) => [o.card, o]));
  const scout = Object.fromEntries(engine.scoutOpponent(state.opponent).cards.map((c) => [c.card, c.stars]));

  const rows = cards
    .map((c) => {
      const opt = optionByCard[c.card];
      const disabled = !opt.affordable;
      const priceTag = opt.free ? `<span class="tag free">GRATIS</span>` : `<span class="tag cost">${opt.cost}</span>`;
      return `
        <button class="card-btn ${disabled ? "disabled" : ""} ${c.isSignature ? "signature" : ""}"
          data-action="choose-card" data-card="${c.card}" ${disabled ? "disabled" : ""}>
          <span class="card-main">
            <span class="card-label">${c.label}${c.isSignature ? " <span class='sig-tag'>firma</span>" : ""}</span>
            <span class="card-rating">${c.rating}/99</span>
          </span>
          <span class="card-side">
            <span class="stars small">${starGlyph(scout[c.card])}</span>
            ${priceTag}
          </span>
        </button>`;
    })
    .join("");

  return `
    ${renderBracket()}
    <section class="panel match">
      ${renderScoreboard()}
      ${renderWalletBar()}
      <p class="set-label">Set ${state.matchSets.length + 1}</p>
      <p class="hint">Le tue carte a sinistra, le sue stelline a destra:</p>
      <div class="card-row">${rows}</div>
    </section>
  `;
}

function renderReveal() {
  const r = state.lastReveal;
  return `
    ${renderBracket()}
    <section class="panel reveal">
      <div class="reveal-score ${r.won ? "won" : "lost"}">${r.score}</div>
      <p class="reveal-comment">${r.comment}</p>
      <p class="reveal-cost">${r.label} — ${r.paid === 0 ? "colpo del campione, gratis" : `costata ${r.paid} crediti`}</p>
      <div class="reveal-tail">
        ${renderScoreboard()}
        ${renderWalletBar()}
        <button class="primary-btn" data-action="after-reveal">Continua</button>
      </div>
    </section>
  `;
}

function renderMatchRecap(matchRecord) {
  const setsHtml = matchRecord.sets
    .map(
      (s) => `<li class="${s.won ? "won" : "lost"}">
        <span class="nb-cat">${s.label}</span>
        <span class="nb-score">${s.score}</span>
        <span class="nb-cost">${s.paid === 0 ? "gratis" : `-${s.paid}`}</span>
      </li>`,
    )
    .join("");

  const opp = matchRecord.opponent;
  const rows = engine.cards
    .map((card) => {
      const mine = state.playerCard.ratings[card];
      const theirs = opp.ratings[card];
      const label = engine.ownProfile(state.playerCard).cards.find((c) => c.card === card).label;
      const lead = mine > theirs ? "mine" : theirs > mine ? "theirs" : "";
      return `<tr>
        <td>${label}</td>
        <td class="${lead === "mine" ? "lead" : ""}">${mine}</td>
        <td class="${lead === "theirs" ? "lead" : ""}">${theirs}</td>
      </tr>`;
    })
    .join("");

  return `<article class="round-recap">
      <h3>${ROUND_LABELS[matchRecord.round]} — ${cardName(opp)} ${opp.year}
        <span class="result-tag ${matchRecord.result}">${matchRecord.result}</span>
        <span class="overall-inline">Overall ${opp.overall}</span>
      </h3>
      <ul class="nb-list">${setsHtml}</ul>
      <table class="stats-table">
        <thead><tr><th>Carta</th><th>${state.playerCard.name}</th><th>${opp.name}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </article>`;
}

function renderFinal() {
  const title = !state.eliminated
    ? "Campione del torneo"
    : currentRound() === "finale"
      ? "Finalista — sconfitto all'ultimo atto"
      : `Eliminato — ${ROUND_LABELS[currentRound()]}`;

  return `
    <section class="panel final">
      <h2 class="final-title ${state.eliminated ? "lost" : "won"}">${title}</h2>
      <p class="lead-in">
        ${cardName(state.playerCard)} ${state.playerCard.year} (Overall ${state.playerCard.overall}) —
        ecco quanto era forte davvero chi hai affrontato.
      </p>
      ${state.history.map((h) => renderMatchRecap(h)).join("")}
      <button class="primary-btn" data-action="restart">Nuovo torneo</button>
    </section>
  `;
}

function render() {
  if (!playersData) {
    root.innerHTML = "<p class='loading'>Caricamento…</p>";
    return;
  }
  if (state.screen === "setup") return renderSetup();
  if (state.screen === "draw") return renderDraw();

  const header = `<header class="app-header compact"><h1>Blind Coach</h1></header>`;
  const body =
    state.screen === "vs-intro"
      ? renderVsIntro()
      : state.screen === "match"
        ? renderMatch()
        : state.screen === "reveal"
          ? renderReveal()
          : renderFinal();
  root.innerHTML = header + body;

  if (state.screen === "vs-intro" && !state.opponentRevealed) {
    spinTo("opp-slot", state.opponent, OPPONENT_DRAW_MS, () => {
      state.opponentRevealed = true;
      render();
    });
  }
}

function resetToSetup() {
  state = { screen: "setup", pickedFormat: "Bo3" };
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  switch (target.dataset.action) {
    case "pick-format":
      state.pickedFormat = target.dataset.format;
      break;
    case "draw-player":
      state.playerCard = randomCard();
      state.drawComplete = false;
      state.screen = "draw";
      break;
    case "start-tournament":
      state = newTournamentState(state.pickedFormat, state.playerCard);
      break;
    case "play-set":
      state.screen = "match";
      break;
    case "choose-card":
      chooseCard(target.dataset.card);
      break;
    case "after-reveal":
      afterReveal();
      break;
    case "restart":
      resetToSetup();
      break;
  }
  render();
});

async function init() {
  resetToSetup();
  render();
  playersData = await (await fetch("./data/players-v1.json")).json();
  engine = createEngine(playersData);
  render();
}

init();
