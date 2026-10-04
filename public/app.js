// FutureMe - lógica do front-end. Nenhuma resposta é armazenada.
const $ = (id) => document.getElementById(id);
const LABEL = { tec:"tecnologia", sau:"saúde e cuidado", com:"comunicação", cri:"criatividade", exa:"números e lógica", pes:"pessoas e comportamento humano", ani:"animais", nat:"natureza", ges:"organização e gestão", con:"construção e projetos", inv:"investigação", lid:"liderança" };
const AREAS = { tec:["Tecnologia","Criar soluções, sistemas e ferramentas digitais."], sau:["Saúde","Cuidar do bem-estar de pessoas e animais."], com:["Comunicação","Se expressar, argumentar e conectar ideias."], cri:["Criatividade","Imaginar e criar coisas novas, visuais ou conceituais."], exa:["Ciências Exatas","Raciocínio lógico, números e dados."], pes:["Pessoas e comportamento","Entender e apoiar pessoas."], ani:["Animais","Trabalhar com saúde e bem-estar animal."], nat:["Natureza","Meio ambiente, ciência e produção sustentável."], ges:["Gestão","Organizar, planejar e fazer projetos acontecerem."], con:["Construção e Engenharia","Projetar e construir o que ainda não existe."], inv:["Investigação","Pesquisar, descobrir e entender causas."], lid:["Liderança","Coordenar pessoas e tomar iniciativa."] };
const MSGS = ["Procurando conexões entre seus interesses…","Cruzando suas respostas com várias áreas…","Buscando cursos que você talvez não conheça…","Quase pronto!"];
const DEMOS = {
  "Tecnologia + criatividade": { tec:8, cri:8, exa:3, inv:2, com:2 },
  "Saúde + comunicação": { sau:8, com:7, pes:6, inv:2 },
  "Animais + natureza": { ani:8, nat:8, sau:3, inv:3 },
  "Exatas + construção": { exa:8, con:8, tec:3, lid:2 },
  "Pessoas + comportamento": { pes:9, com:5, sau:4, inv:3, lid:2 },
};
let perguntas = [], cursos = [], idx = 0, resp = [], msgT;

const show = (id) => { document.querySelectorAll(".screen").forEach((s) => s.classList.remove("on")); $(id).classList.add("on"); window.scrollTo({ top: 0, behavior: "smooth" }); };
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };

async function init() {
  [perguntas, cursos] = await Promise.all([fetch("perguntas.json").then((r) => r.json()), fetch("cursos.json").then((r) => r.json())]);
  const menu = $("demo-menu");
  Object.keys(DEMOS).forEach((n) => { const b = el("button", "", n); b.onclick = () => { menu.hidden = true; $("demo-btn").setAttribute("aria-expanded", "false"); renderResult(localResult(DEMOS[n])); show("s-res"); }; menu.append(b); });
  $("demo-btn").onclick = () => { menu.hidden = !menu.hidden; $("demo-btn").setAttribute("aria-expanded", String(!menu.hidden)); };
}

function start() { idx = 0; resp = []; renderQ(); show("s-quiz"); }
function renderQ() {
  const q = perguntas[idx], pct = Math.round((idx / perguntas.length) * 100);
  $("qnum").textContent = `Pergunta ${idx + 1} de ${perguntas.length}`;
  $("qpct").textContent = pct + "%";
  $("bar").style.width = pct + "%";
  $("bar").parentElement.setAttribute("aria-valuenow", pct);
  $("qtext").textContent = q.pergunta;
  const box = $("opts"); box.replaceChildren();
  q.opcoes.forEach((o, i) => {
    const b = el("button", "opt", o.texto);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(resp[idx] === i));
    b.onclick = () => { resp[idx] = i; box.querySelectorAll(".opt").forEach((x, j) => x.setAttribute("aria-checked", String(j === i))); $("next").disabled = false; };
    box.append(b);
  });
  $("next").disabled = resp[idx] === undefined;
  $("next").textContent = idx === perguntas.length - 1 ? "Ver resultado" : "Continuar";
  $("back").style.visibility = idx === 0 ? "hidden" : "visible";
  $("qtext").focus({ preventScroll: true });
}

function pontuar() {
  const s = {};
  resp.forEach((r, i) => perguntas[i].opcoes[r].tags.forEach((t) => (s[t] = (s[t] || 0) + 1)));
  return s;
}

async function finish() {
  show("s-load");
  let m = 0; $("lmsg").textContent = MSGS[0];
  msgT = setInterval(() => { m = Math.min(m + 1, MSGS.length - 1); $("lmsg").textContent = MSGS[m]; }, 2500);
  const pontuacao = pontuar();
  const respostas = resp.map((r, i) => ({ pergunta: perguntas[i].pergunta, resposta: perguntas[i].opcoes[r].texto }));
  let result;
  // Espera aleatória (0 a 6 s) para uma turma inteira não chamar a IA no mesmo segundo.
  await new Promise((ok) => setTimeout(ok, Math.random() * 6000));
  try {
    const r = await fetch("/api/analisar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ respostas, pontuacao }) });
    if (!r.ok) throw new Error();
    result = await r.json();
  } catch (_) { result = localResult(pontuacao); } // fallback automático se a IA estiver indisponível
  clearInterval(msgT);
  renderResult(result);
  show("s-res");
}

// Motor local: usado no modo demonstração e como fallback se a API falhar.
function localResult(s) {
  const top = Object.entries(s).sort((a, b) => b[1] - a[1]);
  const topTags = top.slice(0, 4).map((x) => x[0]);
  const lista = (arr) => arr.length > 1 ? arr.slice(0, -1).join(", ") + " e " + arr.slice(-1) : arr[0];
  const scored = cursos.map((c) => ({ c, v: c.tags.reduce((a, t, i) => a + (s[t] || 0) * (1 - i * 0.12), 0) + Math.random() * 0.8 })).sort((a, b) => b.v - a.v);
  const pick = [], cnt = {};
  for (const { c } of scored) { const k = c.area.split(" ")[0]; if ((cnt[k] || 0) >= 2) continue; cnt[k] = (cnt[k] || 0) + 1; pick.push(c); if (pick.length === 5) break; }
  return {
    resumo: `Nas suas respostas, ${lista(topTags.slice(0, 3).map((t) => LABEL[t]))} apareceram com bastante frequência. Isso abre espaço para conhecer áreas e graduações que combinam com esses interesses, algumas talvez novas para você.`,
    areas: topTags.slice(0, 3).map((t) => ({ nome: AREAS[t][0], descricao: AREAS[t][1] })),
    cursos: pick.map((c) => {
      const comuns = c.tags.filter((t) => topTags.includes(t)).map((t) => LABEL[t]);
      return { nome: c.nome, area: c.area, afya: c.afya, url: c.url, caminhos: c.caminhos.slice(0, 4),
        porque: `Esse curso apareceu porque suas respostas mostraram interesse por ${lista(comuns.length ? comuns : [LABEL[topTags[0]]])}. A graduação pode levar a caminhos como ${lista(c.caminhos.slice(0, 3))}, entre outros.` };
    }),
  };
}

function renderResult(r) {
  $("r-resumo").textContent = r.resumo || "";
  const a = $("r-areas"); a.replaceChildren();
  (r.areas || []).slice(0, 4).forEach((x) => { const d = el("div", "area"); d.append(el("b", "", x.nome), el("span", "", x.descricao || "")); a.append(d); });
  const c = $("r-cursos"); c.replaceChildren();
  (r.cursos || []).forEach((x) => {
    const d = el("article", "card" + (x.afya ? " afya" : ""));
    if (x.afya) d.append(el("span", "badge", "AFYA JI-PARANÁ"));
    d.append(el("h4", "", x.nome), el("div", "ar", x.area || ""), el("p", "", x.porque || ""));
    if (x.caminhos?.length) { d.append(el("div", "chips-t", "Possíveis caminhos de atuação")); const ch = el("div", "chips"); x.caminhos.forEach((k) => ch.append(el("span", "", k))); d.append(ch); }
    if (x.afya && x.url) { const l = el("a", "btn", "Conheça este curso"); l.href = x.url; l.target = "_blank"; l.rel = "noopener"; d.append(l); }
    c.append(d);
  });
}

$("start").onclick = start;
$("home").onclick = (e) => { e.preventDefault(); show("s-home"); };
$("again").onclick = start;
$("back").onclick = () => { if (idx > 0) { idx--; renderQ(); } };
$("next").onclick = () => { if (idx < perguntas.length - 1) { idx++; renderQ(); } else finish(); };
init();
