// ---- Estado y utilidades ----
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));
const LS_KEY = "continental_state_v1";
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

function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function load() {
  const s = localStorage.getItem(LS_KEY);
  if (s) { state = JSON.parse(s); }
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

  $("#btnSaveRound").disabled = state.players.length === 0 || state.currentRound >= state.rounds.length - 1;
}

function renderPlayers() {
  const wrap = $("#playersList");
  if (state.players.length === 0) { wrap.innerHTML = "<p>No hay jugadores.</p>"; return; }
  wrap.innerHTML = state.players.map((nm,i)=>`
    <div class="player">
      <span class="name">👤 ${nm}</span>
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
  state.players.forEach(nm => html += `<th>${nm}</th>`);
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
      <strong>${state.rounds[r].name}</strong> · Cartas: ${state.rounds[r].cards||""}
      <div class="table" style="margin-top:6px"><table><thead><tr><th>Jugador</th>`;
    state.players.forEach(nm=> html+=`<th>${nm}</th>`);
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
  state.players.forEach(nm => html += `<th>${nm}</th>`);
  html += `</tr></thead><tbody>`;
  for (let r=0; r<state.rounds.length; r++){
    html += `<tr><td>${state.rounds[r].name}</td><td>${state.rounds[r].cards||""}</td>`;
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
  const t = totals();
  const entries = state.players.map((nm,i)=>({name:nm,total:t[i]}))
                     .sort((a,b)=>b.total - a.total);
  let html = `<div class="table"><table><thead><tr><th>Pos</th><th>Jugador</th><th>Total</th></tr></thead><tbody>`;
  entries.forEach((e,idx)=>{
    html += `<tr><td>${idx+1}</td><td>${e.name}</td><td>${e.total}</td></tr>`;
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
