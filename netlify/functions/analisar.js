// Função serverless do Netlify: substitui o server.js. Uma chamada à Gemini por estudante, nada é gravado.
const cursos = require("../../public/cursos.json");
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { erro: "metodo" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { erro: "sem_chave" });
  let dados; try { dados = JSON.parse(event.body || "{}"); } catch (_) { return json(400, { erro: "dados_invalidos" }); }
  const { respostas, pontuacao } = dados;
  if (!Array.isArray(respostas) || respostas.length < 15) return json(400, { erro: "dados_invalidos" });

  const afya = cursos.filter((c) => c.afya).map((c) => `${c.nome} (${c.area}): ${c.caminhos.join(", ")}`);
  const prompt = `Você ajuda estudantes do Ensino Médio a CONHECER possibilidades de cursos de graduação e áreas, a partir dos seus interesses. Você NÃO escolhe a carreira pelo estudante.

RESPOSTAS DO ESTUDANTE:
${respostas.map((r, i) => `${i + 1}. ${r.pergunta} -> ${r.resposta}`).join("\n")}

PONTUAÇÃO POR TEMA (quanto maior, mais apareceu): ${JSON.stringify(pontuacao)}

CURSOS DA AFYA JI-PARANÁ (use os nomes exatamente assim quando fizerem sentido):
${afya.join("\n")}

REGRAS:
- Primeiro identifique de 2 a 4 áreas de interesse; depois relacione-as às características do estudante; depois sugira de 4 a 6 cursos de graduação reais e atuais (da Afya ou não).
- Varie: inclua pelo menos 2 cursos menos óbvios que o estudante talvez nunca tenha considerado. Não repita sempre Medicina, Direito, Psicologia, Enfermagem ou Ciência da Computação; só inclua se as respostas realmente indicarem.
- Linguagem de descoberta e possibilidade ("pode combinar", "talvez seja interessante conhecer", "pode levar a caminhos como"). NUNCA diga "seu curso é", "você deve fazer", "nasceu para" ou "profissão certa".
- Caminhos de atuação são possibilidades, nunca garantia de carreira.
- Cada "porque" deve citar o que apareceu nas respostas (2 a 3 frases curtas, tom jovem e respeitoso, sem parecer infantil).
- Não mencione notas, salários nem promessas de emprego.

Responda SOMENTE com JSON neste formato:
{"resumo":"2 a 3 frases sobre o que apareceu nas respostas","areas":[{"nome":"...","descricao":"1 frase"}],"cursos":[{"nome":"...","area":"ex: Saúde + Comunicação","porque":"...","caminhos":["3 a 5 possibilidades de atuação"]}]}`;


  const inicio = Date.now();
  const principal = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const modelos = [principal, "gemini-flash-latest"].filter((m, i, a) => a.indexOf(m) === i);
  const corpo = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, responseMimeType: "application/json" } });
  try {
    let r = null;
    // O Netlify limita o tempo da função (~10 s no plano gratuito): uma tentativa por modelo, dentro de um prazo.
    for (const model of modelos) {
      const restante = 9000 - (Date.now() - inicio);
      if (restante < 2500) break;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), restante);
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: corpo });
      } catch (_) { r = null; } finally { clearTimeout(t); }
      if (r && r.ok) break;
      console.log(`Gemini ${model}: ${r ? r.status : "sem resposta"}`);
    }
    if (!r || !r.ok) throw new Error("gemini " + (r ? r.status : "sem resposta"));
    const data = await r.json();
    const txt = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("");
    const out = JSON.parse(txt.replace(/```json|```/g, "").trim());
    out.cursos = (out.cursos || []).slice(0, 6).map((c) => {
      const ref = cursos.find((x) => norm(x.nome) === norm(c.nome));
      return { ...c, afya: !!(ref && ref.afya), url: ref && ref.afya ? ref.url : null };
    });
    if (!out.cursos.length) throw new Error("vazio");
    return json(200, out);
  } catch (e) {
    console.log("Erro na IA:", e.message);
    return json(502, { erro: "ia_indisponivel" });
  }
};
