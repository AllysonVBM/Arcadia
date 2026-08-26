// Caso 1: um agente sobrevivendo sozinho, sem contato com outros agentes.
// Objetivos são contexto informativo pro Cognitive Controller — ainda não
// existe verificação automática de "objetivo alcançado" (isso é trabalho
// futuro, um motor de goals/subgoals de verdade).

module.exports = {
  id: 'isolado',
  description: 'Um agente sobrevivendo sozinho, sem contato com outros agentes.',
  agents: [
    { name: 'Pepper', spawnArea: { x: 100, y: 64, z: 100 } },
  ],
  objectives: [
    'Construir um abrigo seguro antes do anoitecer',
    'Conseguir uma fonte de comida renovável (plantação ou pasto)',
    'Craftar um conjunto básico de ferramentas (picareta, machado, espada)',
  ],
}
