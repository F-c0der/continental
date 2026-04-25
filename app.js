// ---- Estado y utilidades ----
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));
const LS_KEY = "continental_state_v1";
const SAVED_GAMES_KEY = "continental_saved_games_v1";
const PROFILE_KEY = "continental_profile_v1";
const DEFAULT_ROUNDS = [
  { name: "R1: Dos Tríos", cards: 7 },
  { name: "R2: Trío + Escalera", cards: 8 },
  { name: "R3: Dos Escaleras", cards: 9 },
  { name: "R4: Dos Tríos + Escalera", cards: 11 },
  { name: "R5: Trío + Dos Escaleras", cards: 12 },
  { name: "R6: Tres Escaleras (Continental)", cards: 13 },
];
const LEGACY_DEFAULT_ROUNDS = [
  "R1: Dos Tríos|7",
  "R2: Trío + Escalera|8",
  "R3: Dos Escaleras|9",
  "R4: Tres Tríos|10",
  "R5: Dos Tríos + Escalera|11",
  "R6: Trío + Dos Escaleras|12",
  "R7: Tres Escaleras|13",
];

let state = {
  players: [],
  rounds: DEFAULT_ROUNDS.map(round => ({...round})),
  scores: [],          // [round][player] -> int
  currentRound: 0
};
let savedGames = [];
let profileName = "";

function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function saveSavedGames() { localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(savedGames)); }
function saveProfile() { localStorage.setItem(PROFILE_KEY, profileName); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}
function load() {
  const s = localStorage.getItem(LS_KEY);
  if (s) { state = JSON.parse(s); }
  savedGames = JSON.parse(localStorage.getItem(SAVED_GAMES_KEY) || "[]");
  profileName = localStorage.getItem(PROFILE_KEY) || "";
  migrateLegacyRounds();
  ensureShape();
}
function roundKey(round) {
  return `${round.name}|${Number(round.cards || 0)}`;
}
function isLegacyDefaultRounds(rounds) {
  return Array.isArray(rounds)
    && rounds.length === LEGACY_DEFAULT_ROUNDS.length
    && rounds.every((round, index) => roundKey(round) === LEGACY_DEFAULT_ROUNDS[index]);
}
function migrateLegacyRounds() {
  if (!isLegacyDefaultRounds(state.rounds)) return;

  state.rounds = DEFAULT_ROUNDS.map(round => ({...round}));
  if (Array.isArray(state.scores) && state.scores.length === LEGACY_DEFAULT_ROUNDS.length) {
    state.scores = [
      state.scores[0],
      state.scores[1],
      state.scores[2],
      state.scores[4],
      state.scores[5],
      state.scores[6],
    ];
  }
  if (state.currentRound > 3) state.currentRound -= 1;
}
function ensureShape() {
  const r = state.rounds.length, p = state.players.length;
  while (state.scores.length < r) state.scores.push(Array(p).fill(0));
  while (state.scores.length > r) state.scores.pop();
  state.scores.forEach(row => {
    while (row.length < p) row.push(0);
    while (row.length > p) row.pop();
  });
  if (state.currentRound >= r) state.currentRound = Math.max(0, r-1);
}
function totals() {
  const p = state.players.length, r = state.rounds.length;
  const t = Array(p).fill(0);
  for (let i=0;i<r;i++) for (let j=0;j<p;j++) t[j]+= Number(state.scores[i][j]||0);
  return t;
}
function playedRounds(game) {
  const rows = game.scores || [];
  return rows.filter(row => row.some(value => Number(value || 0) !== 0)).length;
}
function standingsFor(game) {
  const totals = Array(game.players.length).fill(0);
  for (let r=0; r<(game.rounds || []).length; r++) {
    for (let j=0; j<game.players.length; j++) {
      totals[j] += Number((game.scores[r] || [])[j] || 0);
    }
  }
  return game.players
    .map((name, index) => ({name, index, total: totals[index]}))
    .sort((a, b) => a.total - b.total);
}
function snapshotGame(name) {
  const now = new Date();
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name || `Partida ${now.toLocaleDateString("es-ES")} ${now.toLocaleTimeString("es-ES", {hour:"2-digit", minute:"2-digit"})}`,
    savedAt: now.toISOString(),
    players: clone(state.players),
    rounds: clone(state.rounds),
    scores: clone(state.scores),
    currentRound: state.currentRound,
  };
}
function archiveCurrentGame(name) {
  if (state.players.length === 0) {
    alert("Añade jugadores antes de guardar una partida.");
    return;
  }
  const game = snapshotGame(name);
  const existing = savedGames.findIndex(item => item.name === game.name);
  if (existing >= 0) {
    if (!confirm("Ya hay una partida con ese nombre. ¿Sobrescribirla?")) return;
    savedGames[existing] = game;
  } else {
    savedGames.unshift(game);
  }
  saveSavedGames();
  render();
}
function loadSavedGame(id) {
  const game = savedGames.find(item => item.id === id);
  if (!game) return;
  if (state.players.length && !confirm("Esto sustituirá la partida actual. ¿Continuar?")) return;
  state = {
    players: clone(game.players || []),
    rounds: clone(game.rounds || DEFAULT_ROUNDS),
    scores: clone(game.scores || []),
    currentRound: Number(game.currentRound || 0),
  };
  migrateLegacyRounds();
  ensureShape();
  save();
  render();
}
function deleteSavedGame(id) {
  const game = savedGames.find(item => item.id === id);
  if (!game || !confirm(`¿Borrar "${game.name}" del historial local?`)) return;
  savedGames = savedGames.filter(item => item.id !== id);
  saveSavedGames();
  render();
}
function statsForProfile() {
  const wanted = profileName.trim().toLocaleLowerCase("es-ES");
  if (!wanted) return null;
  const matches = [];
  for (const game of savedGames) {
    const standings = standingsFor(game);
    const pos = standings.findIndex(item => item.name.trim().toLocaleLowerCase("es-ES") === wanted);
    if (pos < 0) continue;
    const entry = standings[pos];
    matches.push({
      game,
      position: pos + 1,
      total: entry.total,
      players: standings.length,
      rounds: playedRounds(game),
      rivals: standings.filter(item => item.index !== entry.index).map(item => item.name),
    });
  }
  return matches;
}

// ---- Render principal ----
function render() {
  const rd = state.rounds[state.currentRound] || {name:"Rondas completadas",cards:""};
  $("#roundTitle").textContent = `▶️ ${rd.name}`;
  $("#roundCards").textContent = rd.cards ? ` · Cartas: ${rd.cards}` : "";

  renderPlayers();
  renderCurrentRound();
  renderPastRounds();
  renderSummary();
  renderRanking();
  renderSavedGames();
  renderProfileStats();

  $("#btnSaveRound").disabled = state.players.length === 0 || state.currentRound >= state.rounds.length - 1;
}

function renderPlayers() {
  const wrap = $("#playersList");
  if (state.players.length === 0) { wrap.innerHTML = "<p>No hay jugadores.</p>"; return; }
  wrap.innerHTML = state.players.map((nm,i)=>`
    <div class="player">
      <span class="name">👤 ${esc(nm)}</span>
      <button class="btn" data-act="rename" data-i="${i}">✏️ Renombrar</button>
      <button class="btn danger" data-act="del" data-i="${i}">🗑️ Quitar</button>
    </div>`).join("");
}

function renderCurrentRound() {
  const box = $("#currentRoundEditor");
  if (state.currentRound >= state.rounds.length) {
    box.innerHTML = "<em>Rondas completadas.</em>";
    return;
  }
  if (state.players.length === 0) {
    box.innerHTML = "<em>Añade jugadores para introducir puntuaciones.</em>";
    return;
  }
  const r = state.currentRound;
  let html = `<div class="table"><table><thead><tr><th>Jugador</th>`;
  state.players.forEach(nm => html += `<th>${esc(nm)}</th>`);
  html += `</tr></thead><tbody><tr><td>Puntos</td>`;
  state.players.forEach((nm,j)=>{
    const v = Number(state.scores[r][j]||0);
    html += `<td><input type="number" class="num" data-r="${r}" data-j="${j}" value="${v}"></td>`;
  });
  html += `</tr></tbody></table></div>
           <div class="row end" style="margin-top:8px">
             <button id="btnSaveCurr" class="btn primary">Guardar cambios en esta ronda</button>
           </div>`;
  box.innerHTML = html;
}

function renderPastRounds() {
  const box = $("#pastRoundsEditor");
  if (state.currentRound === 0 || state.players.length === 0) { box.innerHTML = ""; return; }
  let html = "";
  for (let r=0; r<state.currentRound; r++){
    html += `<div class="card" style="padding:8px;margin:8px 0">
      <strong>${esc(state.rounds[r].name)}</strong> · Cartas: ${state.rounds[r].cards||""}
      <div class="table" style="margin-top:6px"><table><thead><tr><th>Jugador</th>`;
    state.players.forEach(nm=> html+=`<th>${esc(nm)}</th>`);
    html += `</tr></thead><tbody><tr><td>Puntos</td>`;
    state.players.forEach((nm,j)=>{
      const v = Number(state.scores[r][j]||0);
      html+=`<td><input type="number" class="num" data-r="${r}" data-j="${j}" value="${v}"></td>`;
    });
    html += `</tr></tbody></table></div>
             <div class="row end" style="margin-top:6px">
               <button class="btn" data-act="saveRoundRow" data-r="${r}">Guardar cambios</button>
             </div>
    </div>`;
  }
  box.innerHTML = html;
}

function renderSummary() {
  const box = $("#summary");
  if (state.players.length === 0) { box.innerHTML = "<em>Sin jugadores todavía.</em>"; return; }
  let html = `<div class="table"><table><thead><tr><th>Ronda</th><th>Cartas</th>`;
  state.players.forEach(nm => html += `<th>${esc(nm)}</th>`);
  html += `</tr></thead><tbody>`;
  for (let r=0; r<state.rounds.length; r++){
    html += `<tr><td>${esc(state.rounds[r].name)}</td><td>${state.rounds[r].cards||""}</td>`;
    for (let j=0;j<state.players.length;j++) {
      const v = Number((state.scores[r]||[])[j]||0);
      html += `<td>${v}</td>`;
    }
    html += `</tr>`;
  }
  // totals row
  const t = totals();
  html += `<tr><td><strong>TOTAL</strong></td><td></td>`;
  t.forEach(v=> html += `<td><strong>${v}</strong></td>`);
  html += `</tr></tbody></table></div>`;
  box.innerHTML = html;
}

function renderRanking() {
  const box = $("#ranking");
  if (state.players.length === 0) { box.innerHTML = "<em>Sin jugadores.</em>"; return; }
  const entries = standingsFor(state);
  let html = `<div class="table"><table><thead><tr><th>Pos</th><th>Jugador</th><th>Total</th></tr></thead><tbody>`;
  entries.forEach((e,idx)=>{
    html += `<tr><td>${idx+1}</td><td>${esc(e.name)}</td><td>${e.total}</td></tr>`;
  });
  html += `</tbody></table></div>`;
  box.innerHTML = html;
}
function renderSavedGames() {
  const box = $("#savedGames");
  const input = $("#gameName");
  if (input && !input.value) {
    input.value = state.players.length ? `Partida de ${state.players.join(", ")}` : "";
  }
  if (!box) return;
  if (savedGames.length === 0) {
    box.innerHTML = `<p class="stat-muted">Todavía no hay partidas guardadas en este navegador.</p>`;
    return;
  }
  box.innerHTML = savedGames.map(game => {
    const date = new Date(game.savedAt);
    const standings = standingsFor(game);
    const winner = standings[0]?.name || "Sin ganador";
    return `<div class="saved-game">
      <div>
        <strong>${esc(game.name)}</strong>
        <small>${date.toLocaleString("es-ES")} · ${game.players.length} jugadores · ${playedRounds(game)}/${game.rounds.length} rondas · va ganando ${esc(winner)}</small>
      </div>
      <div class="actions">
        <button class="btn" data-act="loadGame" data-id="${game.id}">Cargar</button>
        <button class="btn danger" data-act="deleteGame" data-id="${game.id}">Borrar</button>
      </div>
    </div>`;
  }).join("");
}
function renderProfileStats() {
  const box = $("#profileStats");
  const input = $("#profileName");
  if (!box || !input) return;
  if (document.activeElement !== input) input.value = profileName;
  const matches = statsForProfile();
  if (!profileName.trim()) {
    box.innerHTML = `<p class="stat-muted">Guarda tu nombre tal como lo escribes en las partidas para ver tus estadísticas.</p>`;
    return;
  }
  if (!matches.length) {
    box.innerHTML = `<p class="stat-muted">No he encontrado a ${esc(profileName)} en las partidas guardadas.</p>`;
    return;
  }
  const games = matches.length;
  const wins = matches.filter(item => item.position === 1).length;
  const top3 = matches.filter(item => item.position <= 3).length;
  const avgPosition = matches.reduce((sum, item) => sum + item.position, 0) / games;
  const avgPoints = matches.reduce((sum, item) => sum + item.total, 0) / games;
  const rounds = matches.reduce((sum, item) => sum + item.rounds, 0);
  const rivals = new Set(matches.flatMap(item => item.rivals.map(name => name.trim().toLocaleLowerCase("es-ES"))));
  let html = `<div class="stat-grid">
    <div class="stat-box"><strong>${games}</strong><span>Partidas</span></div>
    <div class="stat-box"><strong>${wins}</strong><span>Victorias</span></div>
    <div class="stat-box"><strong>${top3}</strong><span>Top 3</span></div>
    <div class="stat-box"><strong>${avgPosition.toFixed(1)}</strong><span>Puesto medio</span></div>
    <div class="stat-box"><strong>${avgPoints.toFixed(0)}</strong><span>Puntos medios</span></div>
    <div class="stat-box"><strong>${rounds}</strong><span>Rondas jugadas</span></div>
    <div class="stat-box"><strong>${rivals.size}</strong><span>Rivales distintos</span></div>
  </div>`;
  html += `<div class="table"><table><thead><tr><th>Partida</th><th>Fecha</th><th>Puesto</th><th>Jugadores</th><th>Puntos</th></tr></thead><tbody>`;
  matches.forEach(item => {
    html += `<tr>
      <td>${esc(item.game.name)}</td>
      <td>${new Date(item.game.savedAt).toLocaleDateString("es-ES")}</td>
      <td>${item.position}</td>
      <td>${item.players}</td>
      <td>${item.total}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  box.innerHTML = html;
}

// ---- Eventos ----
document.addEventListener("click", (e)=>{
  const el = e.target;

  if (el.id === "btnAdd") {
    const name = $("#playerName").value.trim();
    if (!name) return;
    state.players.push(name);
    ensureShape(); save(); render();
    $("#playerName").value = "";
  }

  if (el.id === "btnSaveRound") {
    if (state.currentRound < state.rounds.length-1) {
      state.currentRound += 1; save(); render();
    }
  }

  if (el.dataset.act === "rename") {
    const i = Number(el.dataset.i);
    const nn = prompt("Nuevo nombre:", state.players[i]);
    if (nn !== null) {
      state.players[i] = nn.trim() || state.players[i];
      save(); render();
    }
  }
  if (el.dataset.act === "del") {
    const i = Number(el.dataset.i);
    if (confirm(`¿Quitar a ${state.players[i]}?`)) {
      state.players.splice(i,1);
      ensureShape(); save(); render();
    }
  }

  if (el.dataset.act === "saveRoundRow") {
    const r = Number(el.dataset.r);
    save(); render();
  }

  if (el.id === "btnNew") {
    if (confirm("Esto borrará la partida actual. ¿Continuar?")) {
      state.players = [];
      state.scores = [];
      state.currentRound = 0;
      ensureShape(); save(); render();
    }
  }

  if (el.id === "btnSaveGame") {
    archiveCurrentGame($("#gameName").value.trim());
  }

  if (el.id === "btnSaveProfile") {
    profileName = $("#profileName").value.trim();
    saveProfile();
    render();
  }

  if (el.dataset.act === "loadGame") {
    loadSavedGame(el.dataset.id);
  }

  if (el.dataset.act === "deleteGame") {
    deleteSavedGame(el.dataset.id);
  }

  if (el.id === "btnConfig") {
    const dlg = $("#configDlg");
    $("#roundsText").value = state.rounds.map(r => `${r.name} | ${r.cards||0}`).join("\n");
    dlg.showModal();
  }

  if (el.id === "btnSaveRounds") {
    const lines = $("#roundsText").value.split("\n").map(s=>s.trim()).filter(Boolean);
    const rs = [];
    for (const line of lines) {
      const parts = line.split("|");
      const name = (parts[0]||"").trim();
      const cards = Number((parts[1]||"0").trim());
      rs.push({name, cards});
    }
    if (rs.length) {
      state.rounds = rs; ensureShape(); save(); render();
    }
  }

  if (el.id === "btnExport") {
    e.preventDefault();
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "continental_partida.json";
    a.click();
  }
});

document.addEventListener("change", (e)=>{
  const el = e.target;
  if (el.classList.contains("num")) {
    const r = Number(el.dataset.r), j = Number(el.dataset.j);
    let v = parseInt(el.value || "0", 10);
    if (Number.isNaN(v)) v = 0;
    state.scores[r][j] = v;
    save();
  }
  if (el.id === "importFile" && el.files?.length) {
    const file = el.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        state = {
          players: data.players || [],
          rounds: data.rounds || [],
          scores: data.scores || [],
          currentRound: data.currentRound || 0
        };
        ensureShape(); save(); render();
      } catch (e) { alert("No se pudo importar: " + e); }
    };
    reader.readAsText(file);
  }
});

document.addEventListener("submit", (e)=> e.preventDefault());
$("#currentRoundEditor")?.addEventListener("click", (e)=>{
  if (e.target?.id === "btnSaveCurr") { save(); render(); }
});

// init
load();
render();
