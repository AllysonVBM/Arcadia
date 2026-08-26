// Cognitive Controller (PIANO, Passo 5): loop de baixa frequência, separado
// do reflexo, que sintetiza um recorte deliberado do Agent State — nunca o
// estado inteiro, isso é o gargalo proposital — e pede à LLM a próxima
// decisão de alto nível. A decisão vira 'current_intent' no blackboard; quem
// executa é sempre o módulo de Output, nunca este arquivo diretamente.

const blackboard = require('../state/blackboard.js')
const { hasHostileNearby } = require('../state/validators/threat.js')
const ollama = require('../llm/ollamaClient.js')
const persona = require('../identity/persona.js')
const llmConfig = require('../config/llm_cfg.js')
const dispatchIntent = require('./output.js')

function buildContext(bot) {
  const health = blackboard.get('health')
  const hunger = blackboard.get('hunger')
  const position = blackboard.get('position')
  const inventory = blackboard.get('inventory') || []
  const workingMemory = blackboard.get('memory.working') || []
  const threatNearby = hasHostileNearby(bot)

  const inventorySummary = inventory.length
    ? inventory.map((item) => `${item.count}x ${item.name}`).join(', ')
    : 'vazio'

  const recentEvents = workingMemory.length
    ? workingMemory.map((e) => `[${e.who}] ${e.text}`).join('\n')
    : '(nenhum evento recente)'

  return `Estado atual:
- Vida: ${health ?? '?'}/20
- Fome: ${hunger ?? '?'}/20
- Posição: ${position ? `${position.x}, ${position.y}, ${position.z}` : '?'}
- Ameaça hostil por perto: ${threatNearby ? 'sim' : 'não'}
- Inventário: ${inventorySummary}

Eventos recentes:
${recentEvents}`
}

function parseDecision(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.action !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

async function controllerTick(bot) {
  try {
    const context = buildContext(bot)

    const raw = await ollama.chat([
      { role: 'system', content: persona.systemPrompt },
      { role: 'user', content: context },
    ])

    const decision = parseDecision(raw)

    if (!decision) {
      console.error('[cognitive-controller] resposta não era JSON válido:', raw)
      return
    }

    blackboard.set('current_intent', { ...decision, decidedAt: Date.now() })
    dispatchIntent(bot)
  } catch (err) {
    console.error('[cognitive-controller] falhou:', err.message)
  }
}

function startCognitiveController(bot) {
  const interval = setInterval(() => controllerTick(bot), llmConfig.tickIntervalMs)
  return () => clearInterval(interval)
}

module.exports = { startCognitiveController, controllerTick, buildContext, parseDecision }
