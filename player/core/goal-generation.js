// Goal Generation (PIANO): mantém um objetivo de curto prazo emergente, a
// partir da própria trajetória (LTM) e do estado atual — mais devagar que
// o Cognitive Controller, porque um objetivo não deveria mudar a cada
// decisão de ação isolada.
//
// É a peça que faltava entre "reconhecer o problema" e "resolver o
// problema": sem isso, o Controller decidia de novo do zero a cada 15s,
// sem lembrar da própria intenção de um ciclo pro outro — daí agentes que
// diziam "preciso de uma ferramenta melhor" repetidamente, sem nunca de
// fato ir atrás de madeira.

const blackboard = require('../state/blackboard.js')
const ollama = require('../llm/ollamaClient.js')
const llmConfig = require('../config/llm_cfg.js')
const longTermMemory = require('../memory/longTermMemory.js')
const skills = require('../memory/skills.js')
const { GATED_SKILLS } = skills
const eventLog = require('../memory/eventLog.js')
const { getActiveScenario } = require('../config/scenario_cfg.js')

// Contrato anterior pedia só {"goal", "reason"} e comparava a descrição nova
// com a antiga por igualdade EXATA de string pra decidir se "mudou". Na
// prática o modelo quase nunca reafirma o objetivo com o texto idêntico —
// ele reformula ("conseguir pedra bruta para X" vs "fabricar X com pedra
// bruta") — e isso contava como troca de objetivo toda vez, gerando
// centenas de goal_changed que eram só o mesmo objetivo reescrito (visto em
// produção: um agente trocou de objetivo ~150x em 10h, sendo ~115 dessas só
// as duas mesmas frases se alternando). Agora o modelo declara
// explicitamente se é o mesmo objetivo ou não — a comparação por texto vira
// só uma rede de segurança pro caso do campo vir ausente/malformado.
const SYSTEM_PROMPT = `Você ajuda um agente de Minecraft a manter um objetivo de curto prazo — uma frase concreta e acionável (ex.: "conseguir madeira pra fazer uma picareta"), a partir do que ele já sabe fazer, do que já viveu e dos objetivos gerais do cenário, se houver.

Responda SOMENTE com um JSON, sem texto antes ou depois:
{"same_as_before": true ou false, "goal": "descrição curta do objetivo (se same_as_before for true, repita a descrição atual quase palavra por palavra)", "reason": "por quê, uma frase"}

Regras importantes:
- same_as_before deve ser true sempre que o objetivo atual ainda faz sentido. Reformular com outras palavras NÃO conta como objetivo novo — só use false se o atual já foi alcançado, ficou impossível, ou não existir ainda.
- Nunca proponha uma meta que dependa de uma skill que o agente ainda NÃO sabe (veja "Skills conhecidas" e "Skills que ainda não sabe" abaixo) — a menos que a própria meta seja aprender essa skill (praticando sozinho ou pedindo pra outro agente ensinar em troca de moeda). Ex.: se o agente não sabe "craft", não proponha "fabricar X" — proponha aprender a craftar (ou algo que use só skills que ele já tem).
- Use SOMENTE nomes reais de itens/blocos do Minecraft, em inglês, snake_case (ex.: oak_log, oak_planks, crafting_table, wooden_pickaxe, cobblestone, stone_pickaxe). Nunca invente itens que não existem no jogo — se não tiver certeza do nome, descreva a ação sem nomear um item inventado.`

function parseGoal(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.reason !== 'string' || typeof parsed.goal !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

async function generateGoalTick(bot) {
  try {
    const current = blackboard.get('current_goal')
    const knownSkills = skills.listKnownSkills(bot.username)
    const unknownSkills = GATED_SKILLS.filter((s) => !knownSkills.includes(s))
    const scenario = getActiveScenario()

    let sample = []
    try {
      sample = await longTermMemory.recall(bot.username, 'meu progresso e o que ainda preciso fazer', { limit: 6 })
    } catch (err) {
      console.error('[goal-generation] falha ao recuperar LTM:', err.message)
    }

    const memoriesText = sample.length ? sample.map((m) => `- ${m.content}`).join('\n') : '(sem memórias ainda)'

    const context = `Objetivo de curto prazo atual: ${current ? current.description : '(nenhum ainda)'}
Skills conhecidas: ${knownSkills.length ? knownSkills.join(', ') : '(nenhuma)'}
Skills que ainda não sabe (não proponha metas que dependam delas): ${unknownSkills.length ? unknownSkills.join(', ') : '(sabe todas)'}
Objetivos do cenário: ${scenario ? scenario.objectives.join('; ') : '(nenhum cenário ativo)'}
Memórias recentes relevantes:
${memoriesText}`

    const raw = await ollama.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: context },
    ])

    const decision = parseGoal(raw)
    if (!decision || !decision.goal) return

    // same_as_before é a fonte da verdade quando o modelo respeita o
    // contrato. Se vier ausente/malformado, cai pro comportamento antigo
    // (comparação exata) só como rede de segurança — nunca pra decidir
    // "mudou" com mais frequência do que o modelo pediu.
    const sameAsBefore = typeof decision.same_as_before === 'boolean'
      ? decision.same_as_before
      : Boolean(current) && current.description === decision.goal

    const changed = !current || !sameAsBefore

    blackboard.set('current_goal', {
      // Enquanto for "o mesmo objetivo", mantém o texto original em vez de
      // trocar pela reformulação nova — é isso que quebra o ciclo de
      // reescrever a mesma ideia com palavras diferentes a cada 45s.
      description: changed ? decision.goal : current.description,
      reason: decision.reason,
      updatedAt: Date.now(),
    })

    if (changed) {
      eventLog.logEvent(bot.username, 'goal_changed', {
        from: current ? current.description : null,
        to: decision.goal,
        reason: decision.reason,
      })
    }

    console.log(`[goal] ${bot.username} objetivo: ${changed ? decision.goal : current.description} (${decision.reason})`)
  } catch (err) {
    console.error('[goal-generation] falhou:', err.message)
  }
}

function startGoalGeneration(bot) {
  generateGoalTick(bot) // não espera o primeiro ciclo pra ter um objetivo definido
  const interval = setInterval(() => generateGoalTick(bot), llmConfig.goalIntervalMs)
  return () => clearInterval(interval)
}

module.exports = { startGoalGeneration, generateGoalTick, parseGoal }
