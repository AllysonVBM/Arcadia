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
const eventLog = require('../memory/eventLog.js')
const { getActiveScenario } = require('../config/scenario_cfg.js')

const SYSTEM_PROMPT = `Você ajuda um agente de Minecraft a manter um objetivo de curto prazo — uma frase concreta e acionável (ex.: "conseguir madeira pra fazer uma picareta"), a partir do que ele já sabe fazer, do que já viveu e dos objetivos gerais do cenário, se houver.

Responda SOMENTE com um JSON, sem texto antes ou depois:
{"goal": "descrição curta do objetivo, ou null se o atual continua bom", "reason": "por quê, uma frase"}

Só proponha um objetivo NOVO se o atual já foi alcançado, ficou impossível, ou não existir ainda. Prefira manter o mesmo objetivo entre ciclos — trocar toda hora não ajuda o agente a progredir de verdade.`

function parseGoal(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.reason !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

async function generateGoalTick(bot) {
  try {
    const current = blackboard.get('current_goal')
    const knownSkills = skills.listKnownSkills(bot.username)
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
Objetivos do cenário: ${scenario ? scenario.objectives.join('; ') : '(nenhum cenário ativo)'}
Memórias recentes relevantes:
${memoriesText}`

    const raw = await ollama.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: context },
    ])

    const decision = parseGoal(raw)
    if (!decision || !decision.goal) return

    const changed = !current || current.description !== decision.goal

    blackboard.set('current_goal', {
      description: decision.goal,
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

    console.log(`[goal] ${bot.username} objetivo: ${decision.goal} (${decision.reason})`)
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
