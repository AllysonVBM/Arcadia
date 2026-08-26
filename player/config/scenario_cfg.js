// Qual cenário está ativo (se algum) — selecionável por env var
// SCENARIO_ID. Cenários são opcionais: sem SCENARIO_ID, o agente sobe sem
// área de spawn nem objetivos atribuídos, exatamente como já funcionava.

const scenarios = {
  isolado: require('../scenarios/isolado.js'),
  dupla: require('../scenarios/dupla.js'),
  quinteto: require('../scenarios/quinteto.js'),
}

function getActiveScenario() {
  const id = process.env.SCENARIO_ID
  if (!id) return null

  const scenario = scenarios[id]
  if (!scenario) {
    throw new Error(`Cenário "${id}" não existe (disponíveis: ${Object.keys(scenarios).join(', ')})`)
  }
  return scenario
}

function getAgentEntry(scenario, agentName) {
  if (!scenario) return null
  return scenario.agents.find((entry) => entry.name === agentName) || null
}

module.exports = { scenarios, getActiveScenario, getAgentEntry }
