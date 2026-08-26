// Caso 2: dois agentes vivendo em conjunto, na mesma área do mapa (áreas
// de spawn próximas o suficiente pra se encontrarem, mas cada um sobe como
// processo isolado — não sabem um do outro além do que perceberem in-game).

module.exports = {
  id: 'dupla',
  description: 'Dois agentes vivendo em conjunto, na mesma área do mapa.',
  agents: [
    { name: 'Pepper', spawnArea: { x: -200, y: 64, z: -200 } },
    { name: 'Atena', spawnArea: { x: -195, y: 64, z: -195 } },
  ],
  objectives: [
    'Estabelecer uma base compartilhada',
    'Dividir tarefas de sobrevivência entre os dois',
    'Craftar um conjunto básico de ferramentas',
  ],
}
