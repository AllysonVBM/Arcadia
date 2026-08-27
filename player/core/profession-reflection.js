// Profissão emergente: reflexão bem mais lenta que o Cognitive Controller
// (minutos, não segundos) sobre a própria trajetória — nunca sobre a de
// outro agente. Olha uma amostra da LTM e decide/reafirma uma profissão,
// que fica persistida (sobrevive a restart) e volta a alimentar o contexto
// do Controller nas próximas decisões.

const blackboard = require('../state/blackboard.js')
const ollama = require('../llm/ollamaClient.js')
const llmConfig = require('../config/llm_cfg.js')
const longTermMemory = require('../memory/longTermMemory.js')
const profile = require('../memory/profile.js')
const eventLog = require('../memory/eventLog.js')

const SYSTEM_PROMPT = `Você ajuda um agente a refletir sobre sua trajetória num mundo de Minecraft e decidir uma profissão — algo como "minerador", "fazendeiro", "explorador", "construtor", "guerreiro" ou qualquer outra que faça sentido pelo que ele viveu. Responda SOMENTE com um JSON, sem texto antes ou depois, no formato:
{"profession": "nome curto da profissão ou null", "reason": "por quê, uma frase, baseada só nas memórias recebidas"}
Se não houver memória suficiente pra decidir ou mudar nada, responda com "profession": null.`

function parseProfession(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.reason !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

async function reflectOnProfession(agentName) {
  if (longTermMemory.count(agentName) === 0) return // nada pra refletir ainda

  const sample = await longTermMemory.recall(agentName, 'minha trajetória, experiências e escolhas até agora', {
    limit: 10,
  })
  if (sample.length === 0) return

  const current = profile.getProfile(agentName, 'profession')
  const currentText = current ? `Profissão atual: ${current.value}.` : 'Ainda não tem profissão definida.'
  const memoriesText = sample.map((m) => `- ${m.content}`).join('\n')

  try {
    const raw = await ollama.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${currentText}\n\nMemórias:\n${memoriesText}` },
    ])

    const decision = parseProfession(raw)
    if (!decision || !decision.profession) return

    const changed = !current || current.value !== decision.profession

    profile.setProfile(agentName, 'profession', decision.profession)
    blackboard.set('profession', decision.profession)

    if (changed) {
      eventLog.logEvent(agentName, 'profession_changed', {
        from: current ? current.value : null,
        to: decision.profession,
        reason: decision.reason,
      })
    }

    console.log(`[profession] ${agentName} agora é: ${decision.profession} (${decision.reason})`)
  } catch (err) {
    console.error('[profession] reflexão falhou:', err.message)
  }
}

function startProfessionReflection(agentName) {
  // Carrega o que já existe do banco assim que o processo sobe, pra não
  // esperar o primeiro ciclo pra recuperar a profissão de sessões
  // anteriores.
  const existing = profile.getProfile(agentName, 'profession')
  if (existing) blackboard.set('profession', existing.value)

  const interval = setInterval(() => reflectOnProfession(agentName), llmConfig.professionIntervalMs)
  return () => clearInterval(interval)
}

module.exports = { startProfessionReflection, reflectOnProfession, parseProfession }
