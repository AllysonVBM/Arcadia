// Relatório de uma sessão sem monitoramento ao vivo — lê o log estruturado
// (data/<agente>/events.log) e o estado atual de cada agente (SQLite:
// skills, moeda, profissão, contagem de LTM) e imprime um resumo legível,
// além de salvar em data/reports/<timestamp>.md pra ficar arquivado.
//
// Uso: node player/report.js  (ou: npm run report)
//
// Só leitura — nunca escreve nada nos bancos dos agentes. Seguro rodar com
// o swarm ativo ao mesmo tempo.

const fs = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')

const { DATA_DIR } = require('./memory/db.js')
const { readEvents } = require('./memory/eventLog.js')
const { GATED_SKILLS } = require('./memory/skills.js')

// Eventos frequentes o suficiente pra virar contagem, não linha por linha.
const SUMMARIZED_EVENT_TYPES = new Set(['action_succeeded'])

function formatTime(ms) {
  return new Date(ms).toLocaleString('pt-BR')
}

function describeEvent(e) {
  switch (e.type) {
    case 'spawned':
      return 'nasceu no mundo'
    case 'died':
      return `morreu${e.position ? ` em ${e.position.x}, ${e.position.y}, ${e.position.z}` : ''}`
    case 'kicked':
      return `kickado do servidor: ${e.reason}`
    case 'connection_error':
      return `erro de conexão: ${e.message}`
    case 'disconnected':
      return `desconectado: ${e.reason}`
    case 'reconnect_scheduled':
      return `reconectando em ${e.delayMs / 1000}s`
    case 'skill_learned':
      return `aprendeu "${e.skill}" (${e.via})`
    case 'skill_bought':
      return `comprou "${e.skill}" de ${e.from} por ${e.price}`
    case 'skill_sold':
      return `vendeu "${e.skill}" pra ${e.to} por ${e.price}`
    case 'profession_changed':
      return `profissão: ${e.from ?? '(nenhuma)'} → ${e.to} (${e.reason})`
    case 'goal_changed':
      return `objetivo: ${e.from ?? '(nenhum)'} → "${e.to}" (${e.reason})`
    default:
      return JSON.stringify(e)
  }
}

function readAgentState(agentName) {
  const dbPath = path.join(DATA_DIR, agentName, 'memory.sqlite')
  if (!fs.existsSync(dbPath)) return null

  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const skillRows = db.prepare('SELECT skill, known, practice_attempts FROM skills').all()
    const known = skillRows.filter((s) => s.known).map((s) => s.skill)
    const inProgress = skillRows.filter((s) => !s.known && s.practice_attempts > 0)

    const memCount = db.prepare('SELECT COUNT(*) as c FROM memories').get().c
    const profile = db.prepare('SELECT key, value FROM profile').all()
    const profileMap = Object.fromEntries(profile.map((p) => [p.key, p.value]))

    return {
      knownSkills: known,
      totalGatedSkills: GATED_SKILLS.length,
      inProgressSkills: inProgress,
      ltmCount: memCount,
      profession: profileMap.profession || null,
      currency: profileMap.currency ? Number(profileMap.currency) : null,
    }
  } finally {
    db.close()
  }
}

function reportForAgent(agentName) {
  const state = readAgentState(agentName)
  const events = readEvents(agentName)

  const lines = []
  lines.push(`## ${agentName}`)
  lines.push('')

  if (!state) {
    lines.push('_Sem dados ainda — nunca chegou a nascer no mundo._')
    lines.push('')
    return lines.join('\n')
  }

  lines.push(`- Profissão: ${state.profession || 'ainda não definida'}`)
  lines.push(`- Skills conhecidas (${state.knownSkills.length}/${state.totalGatedSkills}): ${state.knownSkills.join(', ') || 'nenhuma'}`)
  if (state.inProgressSkills.length) {
    lines.push(`- Em progresso: ${state.inProgressSkills.map((s) => `${s.skill} (${s.practice_attempts}/8)`).join(', ')}`)
  }
  lines.push(`- Moeda: ${state.currency ?? '?'}`)
  lines.push(`- Memórias de longo prazo: ${state.ltmCount}`)
  lines.push('')

  if (events.length === 0) {
    lines.push('_Nenhum evento registrado ainda._')
    lines.push('')
    return lines.join('\n')
  }

  const first = events[0]
  const last = events[events.length - 1]
  lines.push(`### Linha do tempo (${events.length} eventos, de ${formatTime(first.at)} até ${formatTime(last.at)})`)
  lines.push('')

  const milestones = events.filter((e) => !SUMMARIZED_EVENT_TYPES.has(e.type))
  for (const e of milestones) {
    lines.push(`- ${formatTime(e.at)} — ${describeEvent(e)}`)
  }

  const successCounts = new Map()
  for (const e of events) {
    if (e.type !== 'action_succeeded') continue
    successCounts.set(e.skill, (successCounts.get(e.skill) || 0) + 1)
  }

  if (successCounts.size > 0) {
    lines.push('')
    lines.push('### Ações bem-sucedidas (contagem)')
    for (const [skill, count] of [...successCounts.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${skill}: ${count}x`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log('Nenhum agente rodou ainda — data/ não existe.')
    return
  }

  const agents = fs
    .readdirSync(DATA_DIR)
    .filter((name) => fs.statSync(path.join(DATA_DIR, name)).isDirectory())
    .filter((name) => name !== 'reports' && !name.startsWith('_'))
    .sort()

  if (agents.length === 0) {
    console.log('Nenhum agente com dados ainda.')
    return
  }

  const generatedAt = new Date()
  const header = `# Relatório Arcadia — ${generatedAt.toLocaleString('pt-BR')}\n`

  const body = agents.map(reportForAgent).join('\n')
  const fullReport = header + '\n' + body

  console.log(fullReport)

  const reportsDir = path.join(DATA_DIR, 'reports')
  fs.mkdirSync(reportsDir, { recursive: true })
  const fileName = `${generatedAt.toISOString().replace(/[:.]/g, '-')}.md`
  const filePath = path.join(reportsDir, fileName)
  fs.writeFileSync(filePath, fullReport)

  console.log(`\n(salvo em ${filePath})`)
}

if (require.main === module) {
  main()
}

module.exports = { reportForAgent, readAgentState }
