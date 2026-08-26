// Contrato de resposta do Cognitive Controller — igual pra qualquer
// persona, porque é protocolo técnico, não personalidade. Toda persona
// deve terminar seu system prompt anexando isso, sem reescrever o formato
// à mão — é o que garante que output.js consiga interpretar a decisão de
// qualquer agente do mesmo jeito.

const responseContract = `Você recebe um resumo do estado atual e deve responder SOMENTE com um objeto JSON, sem nenhum texto antes ou depois, sem markdown, no formato:
{"action": "flee" | "eat" | "follow" | "idle" | "speak", "target": "username opcional, usado só em follow", "message": "fala opcional para o chat do jogo", "reason": "raciocínio curto, uma frase"}`

module.exports = { responseContract }
