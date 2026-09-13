import { createEngine } from "./engine/index.js";
import { flagFor } from "./flags.js";

const ROUNDS = ["ottavi", "quarti", "semifinale", "finale"];
const ROUND_LABELS = {
  ottavi: "Ottavi",
  quarti: "Quarti",
  semifinale: "Semifinale",
  finale: "Finale",
};
const SETS_TO_WIN = { Bo3: 2, Bo5: 3 };
const PLAYER_DRAW_MS = 2300;
const OPPONENT_DRAW_MS = 1200;

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
  games_won_pct: "% game vinti",
  straight_sets_win_pct: "% vittorie senza perdere set",
  comeback_win_pct: "% rimonte da sotto di un set",
  first_set_win_pct: "% primi set vinti",
  clay_win_pct: "% vittorie sulla terra",
  hard_win_pct: "% vittorie sul cemento",
};

const root = document.getElementById("app");

let state = null;
let playersData = null;
let engine = null;

const cardName = (card) => `${flagFor(card.country)} ${card.name}`.trim();

// Tennis scoreboards use surnames. Sackmann names are "First Last" or
// "First Last Last", so dropping the first token is the right call more often
// than taking only the final one ("Bautista Agut", not "Agut").
const surname = (card) => card.name.split(" ").slice(1).join(" ") || card.name;
const shortCardName = (card) => `${flagFor(card.country)} ${surname(card)}`.trim();

/**
 * Slot-machine draw: flick through random cards, slowing down, then land on
 * the one already decided. The result is picked before the animation starts --
 * the spinning is theatre, not the draw itself.
 */
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
    // A newer draw (or a re-render) has superseded this one.
    if (token !== animationToken || !el.isConnected) return;

    const t = Math.min(1, (now - start) / durationMs);
    const interval = 45 + 400 * t ** 3; // flicks fast, then drags out
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
    opponentRevealed: false,
    facedIds: new Set([playerCard.id, opponent.id]),
    facedPlayerIds,
    usedCategories: new Set(),
    playerSets: 0,
    opponentSets: 0,
    currentOptions: [],
    lastReveal: null,
    history: [],
    matchSets: [],
  };
}

const currentRound = () => ROUNDS[state.roundIndex];

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
  // Record what the alternatives would have been, for the end-of-tournament
  // pagella only -- this is never surfaced before the choice is made.
  const alternatives = state.currentOptions.map((opt) => ({
    key: opt.key,
    label: opt.label,
    probability: engine.probabilityFor(state.playerCard, state.opponent, opt.key),
    chosen: opt.key === categoryKey,
  }));

  state.usedCategories.add(categoryKey);
  if (outcome.won) state.playerSets++;
  else state.opponentSets++;

  const setRecord = { ...outcome, alternatives };
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

  if (!wonMatch || state.roundIndex === ROUNDS.length - 1) {
    state.eliminated = !wonMatch;
    state.screen = "final";
    return;
  }

  state.roundIndex++;
  state.playerSets = 0;
  state.opponentSets = 0;
  state.usedCategories = new Set();
  state.matchSets = [];
  state.opponent = randomOpponent(state.facedIds, state.facedPlayerIds);
  state.facedIds.add(state.opponent.id);
  state.facedPlayerIds.add(state.opponent.player_id);
  state.opponentRevealed = false;
  state.screen = "vs-intro";
}

function renderSetup() {
  root.innerHTML = `
    <header class="app-header">
      <h1>Blind Coach</h1>
      <p class="tagline">Alleni una carriera senza vedere i numeri</p>
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
        ${playersData.players.length} stagioni reali dal 1973 al 2025. Il giocatore che allenerai
        viene estratto a sorte — e le sue statistiche restano coperte: le scoprirai solo dal modo
        in cui vinci o perdi i set.
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
        let detail = "";
        if (played) {
          cls += played.result === "vinto" ? " won" : " lost";
          detail = `<span class="bracket-opp">${shortCardName(played.opponent)}</span>`;
        } else if (i === state.roundIndex) {
          cls += " active";
          // Naming the opponent here while the draw is still spinning would
          // give away the result before the slot lands.
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

function renderVsIntro() {
  const p = state.playerCard;
  return `
    ${renderBracket()}
    <section class="panel vs-intro">
      <h2>${ROUND_LABELS[currentRound()]}</h2>
      <div class="vs-card">
        <div class="vs-side">
          <div class="slot-card landed">
            <div class="slot-flag">${flagFor(p.country) || "🎾"}</div>
            <div class="slot-name">${p.name}</div>
            <div class="slot-year">${p.year}</div>
          </div>
        </div>
        <div class="vs-sep">vs</div>
        <div class="vs-side">
          <div id="opp-slot" class="slot compact">${slotCardHtml(state.opponent, state.opponentRevealed)}</div>
        </div>
      </div>
      <button class="primary-btn" data-action="play-set" ${state.opponentRevealed ? "" : "hidden"}>
        Gioca il primo set
      </button>
    </section>
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

/**
 * What the player has earned the right to know: which lens they played and
 * how heavily it won or lost. Never a stat value -- the numbers stay covered
 * until the pagella, or the game becomes a memory test.
 */
function renderNotebook() {
  if (state.matchSets.length === 0 && state.history.length === 0) return "";

  const thisMatch = state.matchSets
    .map(
      (set, i) => `<li class="${set.won ? "won" : "lost"}">
        <span class="nb-set">Set ${i + 1}</span>
        <span class="nb-cat">${set.categoryLabel}</span>
        <span class="nb-score">${set.score}</span>
      </li>`,
    )
    .join("");

  // Earlier rounds, grouped by lens: the useful question isn't "what happened
  // in the quarters", it's "what do I know about my player on this axis".
  const byCategory = new Map();
  for (const round of state.history) {
    for (const set of round.sets) {
      if (!byCategory.has(set.categoryLabel)) byCategory.set(set.categoryLabel, []);
      byCategory.get(set.categoryLabel).push({ score: set.score, won: set.won, round: ROUND_LABELS[round.round] });
    }
  }

  const past = [...byCategory.entries()]
    .map(
      ([label, entries]) => `<li>
        <span class="nb-cat">${label}</span>
        <span class="nb-history">${entries
          .map((e) => `<span class="${e.won ? "won" : "lost"}">${e.score}</span>`)
          .join(" · ")}</span>
      </li>`,
    )
    .join("");

  return `
    <div class="notebook">
      <h3 class="notebook-title">Taccuino</h3>
      ${thisMatch ? `<ul class="nb-list">${thisMatch}</ul>` : `<p class="hint nb-empty">Primo set di questo match.</p>`}
      ${
        past
          ? `<details class="nb-past"${state.notebookOpen ? " open" : ""}>
              <summary>Nei turni precedenti (${byCategory.size} ${byCategory.size === 1 ? "lente provata" : "lenti provate"})</summary>
              <ul class="nb-list grouped">${past}</ul>
            </details>`
          : ""
      }
    </div>
  `;
}

function renderMatch() {
  return `
    ${renderBracket()}
    <section class="panel match">
      ${renderScoreboard()}
      <p class="set-label">Set ${state.matchSets.length + 1}</p>
      <p class="hint">Scegli la tua lente tattica:</p>
      <div class="tactic-row">
        ${state.currentOptions
          .map(
            (opt) => `<button class="tactic-btn" data-action="choose-category" data-key="${opt.key}">${opt.label}</button>`,
          )
          .join("")}
      </div>
      ${renderNotebook()}
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
      <div class="reveal-tail">
        ${renderScoreboard()}
        <button class="primary-btn" data-action="after-reveal">Continua</button>
      </div>
    </section>
  `;
}

function renderStatsTable(matchRecord) {
  const usedKeys = new Set(matchRecord.sets.map((s) => s.categoryKey));
  const fmt = (v) => (v == null ? "<span class='muted'>n.d.</span>" : `${v}%`);

  const rows = engine.statKeys
    .map((key) => {
      const mine = state.playerCard.stats[key];
      const theirs = matchRecord.opponent.stats[key];
      if (mine == null && theirs == null) return "";
      const lead = mine != null && theirs != null ? (mine > theirs ? "mine" : "theirs") : "";
      return `<tr class="${usedKeys.has(key) ? "used-stat" : ""}">
        <td>${STAT_LABELS[key] || key}</td>
        <td class="${lead === "mine" ? "lead" : ""}">${fmt(mine)}</td>
        <td class="${lead === "theirs" ? "lead" : ""}">${fmt(theirs)}</td>
      </tr>`;
    })
    .join("");

  return `<table class="stats-table">
      <thead><tr><th>Statistica</th><th>${state.playerCard.name}</th><th>${matchRecord.opponent.name}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderSetRecap(set) {
  const alts = (set.alternatives || [])
    .slice()
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
    .map((alt) => {
      const pctText = alt.probability == null ? "—" : `${Math.round(alt.probability * 100)}%`;
      return `<li class="${alt.chosen ? "chosen-alt" : ""}">
        ${alt.label} <span class="alt-prob">${pctText}</span>${alt.chosen ? " <em>← la tua scelta</em>" : ""}
      </li>`;
    })
    .join("");

  return `<li class="set-recap">
      <div class="set-head"><strong>${set.score}</strong> — ${set.comment}</div>
      <ul class="alt-list">${alts}</ul>
    </li>`;
}

function renderFinal() {
  const title = !state.eliminated
    ? "Campione del torneo"
    : currentRound() === "finale"
      ? "Finalista — sconfitto all'ultimo atto"
      : `Eliminato — ${ROUND_LABELS[currentRound()]}`;
  const recaps = state.history
    .map(
      (h) => `<article class="round-recap">
        <h3>${ROUND_LABELS[h.round]} — ${cardName(h.opponent)} ${h.opponent.year}
          <span class="result-tag ${h.result}">${h.result}</span></h3>
        <ul class="set-list">${h.sets.map(renderSetRecap).join("")}</ul>
        ${renderStatsTable(h)}
      </article>`,
    )
    .join("");

  return `
    <section class="panel final">
      <h2 class="final-title ${state.eliminated ? "lost" : "won"}">${title}</h2>
      <p class="lead-in">
        ${cardName(state.playerCard)} ${state.playerCard.year} — ecco la pagella:
        tutte le statistiche vere, e cosa sarebbero valse le opzioni che hai scartato.
      </p>
      ${recaps}
      <button class="primary-btn" data-action="restart">Nuovo torneo</button>
    </section>
  `;
}

function render() {
  if (!playersData) {
    root.innerHTML = "<p class='loading'>Caricamento…</p>";
    return;
  }
  if (state.screen === "setup") {
    renderSetup();
    return;
  }
  if (state.screen === "draw") {
    renderDraw();
    return;
  }

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

  // <details> toggle doesn't bubble, so it can't go through the delegated
  // click handler; remember the open state across re-renders directly.
  const notebookPast = root.querySelector(".nb-past");
  if (notebookPast) {
    notebookPast.addEventListener("toggle", () => {
      state.notebookOpen = notebookPast.open;
    });
  }

  if (state.screen === "vs-intro" && !state.opponentRevealed) {
    spinTo("opp-slot", state.opponent, OPPONENT_DRAW_MS, () => {
      state.opponentRevealed = true;
      const button = root.querySelector('[data-action="play-set"]');
      if (button) button.hidden = false;
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
      // The card is decided here; the animation that follows only reveals it.
      state.playerCard = randomCard();
      state.drawComplete = false;
      state.screen = "draw";
      break;
    case "start-tournament":
      state = newTournamentState(state.pickedFormat, state.playerCard);
      break;
    case "play-set":
      startSet();
      break;
    case "choose-category":
      chooseCategory(target.dataset.key);
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

async function loadPlayersData() {
  // Embedded when the page ships as a single self-contained bundle; fetched
  // when it's served as a normal static site.
  const embedded = document.getElementById("players-data");
  if (embedded) return JSON.parse(embedded.textContent);
  return (await fetch("./data/players.json")).json();
}

async function init() {
  resetToSetup();
  render();
  playersData = await loadPlayersData();
  engine = createEngine(playersData);
  render();
}

init();
