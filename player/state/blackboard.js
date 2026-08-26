// Estado compartilhado do agente: um único lugar de onde percepção grava
// e validadores/reflexo leem. Hoje é um Map em memória; a interface
// (get/set/has/delete) é a mesma que um adapter de Redis vai expor
// futuramente, então trocar a implementação não deve exigir mudar quem
// consome este módulo.

const store = new Map()

function set(key, value) {
  store.set(key, { value, updatedAt: Date.now() })
}

function get(key) {
  const entry = store.get(key)
  return entry ? entry.value : undefined
}

function getEntry(key) {
  return store.get(key) // { value, updatedAt } ou undefined
}

function has(key) {
  return store.has(key)
}

function del(key) {
  store.delete(key)
}

module.exports = { set, get, getEntry, has, delete: del }
