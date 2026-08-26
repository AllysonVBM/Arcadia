// Output: o único ponto que traduz uma decisão em fala + ação no jogo. Só
// reage ao current_intent mais recente do Agent State — nunca gera fala e
// ação a partir de fontes diferentes. É essa disciplina que evita o agente
// dizer uma coisa e fazer outra (Passo 6 do PIANO).
//
// Sobrevivência como prioridade máxima: se o reflexo estiver com a trava
// ativa (reflexLock), uma decisão do Controller que mexeria em movimento
// é ignorada nesse ciclo — fala ainda passa, porque não interfere fisicamente.
//
// Skills "gated" (mine/craft/place/cook e as futuras hunt/plant/swim/fight/
// bow) só executam de verdade se o agente já souber — sem saber, é uma
// tentativa de prática (chance crescente de dar certo, ver memory/skills.js).

const blackboard = require('../state/blackboard.js')
const reflexLock = require('../state/reflexLock.js')
const skills = require('../memory/skills.js')
const flee = require('../skills/flee.js')
const eat = require('../skills/eat.js')
const follow = require('../skills/follow.js')
const mine = require('../skills/mine.js')
const craftItem = require('../skills/craftItem.js')
const placeBlock = require('../skills/placeBlock.js')
const cookItem = require('../skills/cookItem.js')
const explore = require('../skills/explore.js')
const teach = require('../skills/teach.js')
const hunt = require('../skills/hunt.js')
const fight = require('../skills/fight.js')
const bow = require('../skills/bow.js')
const plant = require('../skills/plant.js')
const swim = require('../skills/swim.js')

const MOVEMENT_ACTIONS = new Set([
  'flee', 'eat', 'follow', 'mine', 'craft', 'place', 'cook', 'explore',
  'hunt', 'fight', 'bow', 'plant', 'swim',
])

// Executa uma skill "gated": se o agente já sabe, roda normal. Se não sabe,
// tenta mesmo assim — sorteia pela chance de prática (memory/skills.js) e
// só executa a skill de verdade se der certo; senão, é só uma tentativa
// frustrada (soma progresso, não move o bot).
function runGated(bot, skillName, executeFn) {
  if (skills.knowsSkill(bot.username, skillName)) {
    executeFn().catch((err) => console.error(`[output] falha ao executar ${skillName}:`, err.message))
    return
  }

  const succeeded = skills.attemptWithoutKnowledge(bot.username, skillName)

  if (!succeeded) {
    bot.chat(`Ainda não sei fazer isso direito (${skillName}), mas vou continuar tentando.`)
    return
  }

  bot.chat(`Acho que consegui, na base da tentativa (${skillName})!`)
  executeFn().catch((err) => console.error(`[output] falha ao executar ${skillName}:`, err.message))
}

function dispatchIntent(bot) {
  const intent = blackboard.get('current_intent')
  if (!intent) return

  if (intent.message) {
    bot.chat(intent.message)
  }

  if (reflexLock.isActive() && MOVEMENT_ACTIONS.has(intent.action)) {
    console.log(`[output] reflexo em sobrevivência, ignorando decisão do Controller: ${intent.action}`)
    return
  }

  switch (intent.action) {
    case 'flee':
      flee(bot)
      break
    case 'eat':
      eat(bot).catch((err) => console.error('[output] falha ao comer:', err.message))
      break
    case 'follow':
      if (intent.target) follow(bot, intent.target)
      break
    case 'mine':
      if (intent.target) runGated(bot, 'mine', () => mine(bot, intent.target))
      break
    case 'craft':
      if (intent.target) runGated(bot, 'craft', () => craftItem(bot, intent.target))
      break
    case 'place':
      if (intent.target) runGated(bot, 'place', () => placeBlock(bot, intent.target))
      break
    case 'cook':
      if (intent.target) runGated(bot, 'cook', () => cookItem(bot, intent.target))
      break
    case 'explore':
      explore(bot)
      break
    case 'hunt':
      runGated(bot, 'hunt', () => hunt(bot))
      break
    case 'fight':
      runGated(bot, 'fight', () => fight(bot))
      break
    case 'bow':
      runGated(bot, 'bow', () => bow(bot))
      break
    case 'plant':
      runGated(bot, 'plant', () => plant(bot))
      break
    case 'swim':
      runGated(bot, 'swim', () => swim(bot))
      break
    case 'teach':
      if (intent.target && intent.skill && intent.price != null) {
        teach(bot, intent.skill, intent.price, intent.target)
      }
      break
    case 'idle':
    default:
      // 'idle' precisa de fato parar o bot — sem isso, um goal de
      // movimento de uma decisão anterior (ex.: follow) continuava rodando
      // pra sempre, porque nada nunca cancelava.
      if (bot.pathfinder) bot.pathfinder.setGoal(null)
      break
  }
}

module.exports = dispatchIntent
