// Caso 3: cinco agentes sobrevivendo juntos, mesmo mapa, área compartilhada.

module.exports = {
  id: 'quinteto',
  description: 'Cinco agentes sobrevivendo juntos, na mesma área do mapa.',
  agents: [
    { name: 'Pepper', spawnArea: { x: 300, y: 64, z: 300 } },
    { name: 'Atena', spawnArea: { x: 305, y: 64, z: 300 } },
    { name: 'Milo', spawnArea: { x: 300, y: 64, z: 305 } },
    { name: 'Vex', spawnArea: { x: 295, y: 64, z: 300 } },
    { name: 'Sol', spawnArea: { x: 300, y: 64, z: 295 } },
  ],
  objectives: [
    'Estabelecer uma base compartilhada',
    'Organizar divisão de tarefas entre os cinco',
    'Garantir comida suficiente pro grupo todo',
    'Craftar um conjunto básico de ferramentas',
  ],
}
