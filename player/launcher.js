// Lançador multiagente: sobe N processos Node independentes, um por
// identidade. Isolamento real de processo, não só de convenção — cada
// filho tem seu próprio module registry, seu próprio blackboard, sua
// própria LTM, sua própria dashboard. O lançador não repassa NENHUMA
// informação de jogo entre eles; cada um só recebe a própria identidade
// via AGENT_NAME. O roster (config/player_cfg.js) é só a lista de quem
// pode ser lançado, não conhecimento compartilhado em tempo de execução.
//
// Uso:
//   node player/launcher.js              # sobe todo mundo do roster
//   node player/launcher.js Pepper       # só o agente isolado
//   node player/launcher.js Pepper Atena # a dupla

const { fork } = require('child_process')
const path = require('path')
const roster = require('./config/player_cfg.js')

const CONNECT_PATH = path.join(__dirname, 'connect.js')

function resolveNames(args) {
  if (args.length === 0) return roster.map((entry) => entry.name)

  const valid = new Set(roster.map((entry) => entry.name))
  const invalid = args.filter((name) => !valid.has(name))

  if (invalid.length > 0) {
    throw new Error(
      `Identidade(s) não encontrada(s) no roster: ${invalid.join(', ')} (disponíveis: ${[...valid].join(', ')})`
    )
  }

  return args
}

function prefixAndForward(name, chunk, stream) {
  const text = chunk.toString()
  for (const line of text.split('\n')) {
    if (line.length === 0) continue
    stream.write(`[${name}] ${line}\n`)
  }
}

function launchAgent(name) {
  const child = fork(CONNECT_PATH, [], {
    env: { ...process.env, AGENT_NAME: name },
    silent: true, // pipe stdio em vez de herdar — permite prefixar por agente
  })

  child.stdout.on('data', (chunk) => prefixAndForward(name, chunk, process.stdout))
  child.stderr.on('data', (chunk) => prefixAndForward(name, chunk, process.stderr))

  child.on('exit', (code, signal) => {
    console.log(`[launcher] ${name} encerrou (code=${code}, signal=${signal})`)
  })

  child.on('error', (err) => {
    console.error(`[launcher] falha ao subir ${name}:`, err.message)
  })

  return child
}

function main() {
  const names = resolveNames(process.argv.slice(2))
  console.log(`[launcher] subindo ${names.length} agente(s): ${names.join(', ')}`)

  const children = names.map(launchAgent)
  let shuttingDown = false

  function shutdown(signal) {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\n[launcher] recebido ${signal}, encerrando todos os agentes...`)
    for (const child of children) child.kill('SIGINT')
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

if (require.main === module) {
  main()
}

module.exports = { resolveNames, launchAgent }
