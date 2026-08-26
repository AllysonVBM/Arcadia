// Consolidação STM -> LTM: roda bem mais devagar que o Cognitive Controller
// (minutos, não segundos). Pede à LLM pra decidir, a partir dos eventos
// recentes (working memory), o que vale a pena virar memória de longo
// prazo — e com que importância (1-10, escala de Park et al. 2023). Se
// nada for relevante, não escreve nada; é esperado que a maioria dos ciclos
// não gere memória nenhuma.

const blackboard = require('../state/blackboard.js')
const ollama = require('../llm/ollamaClient.js')
const llmConfig = require('../config/llm_cfg.js')
const longTermMemory = require('./longTermMemory.js')

const SYSTEM_PROMPT = `Você ajuda um agente a decidir o que vale a pena lembrar por muito tempo, a partir dos eventos recentes dele. Responda SOMENTE com um JSON, sem texto antes ou depois, no formato:
{"memories": [{"content": "resumo de uma memória, em 1a pessoa, uma frase", "importance": 1-10}]}
Se nada for relevante o suficiente pra virar memória de longo prazo, responda {"memories": []}. Não invente eventos que não estão na lista recebida.`

function parseMemories(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.memories)) return []
    return parsed.memories.filter((m) => m && typeof m.content === 'string')
  } catch {
    return []
  }
}

async function consolidateTick(agentName) {
  const working = blackboard.get('memory.working') || []
  if (working.length === 0) return

  const eventsText = working.map((e) => `[${e.who}] ${e.text}`).join('\n')

  try {
    const raw = await ollama.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Eventos recentes:\n${eventsText}` },
    ])

    const memories = parseMemories(raw)

    for (const m of memories) {
      const importance = Math.min(10, Math.max(1, Number(m.importance) || 5))
      await longTermMemory.remember(agentName, { kind: 'episodic', content: m.content, importance })
    }

    if (memories.length > 0) {
      console.log(`[memory] ${memories.length} memória(s) consolidada(s) para ${agentName}`)
    }
  } catch (err) {
    console.error('[memory] consolidação falhou:', err.message)
  }
}

function startConsolidation(agentName) {
  const interval = setInterval(() => consolidateTick(agentName), llmConfig.consolidationIntervalMs)
  return () => clearInterval(interval)
}

module.exports = { startConsolidation, consolidateTick, parseMemories }
