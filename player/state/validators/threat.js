// Detecção de ameaça: usada tanto pelo reflex-loop (pra decidir prioridade
// entre fugir e comer) quanto pela skill de fuga (pra saber de quem fugir).

const NEARBY_RADIUS = 16

function isHostileEntity(entity) {
  return entity.kind === 'Hostile mobs'
}

function nearestHostile(bot) {
  return bot.nearestEntity(isHostileEntity)
}

function hasHostileNearby(bot, radius = NEARBY_RADIUS) {
  const threat = nearestHostile(bot)
  if (!threat) return false

  const distance = bot.entity.position.distanceTo(threat.position)
  return distance <= radius
}

module.exports = { isHostileEntity, nearestHostile, hasHostileNearby }
