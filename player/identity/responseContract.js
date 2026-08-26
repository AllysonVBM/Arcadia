// Contrato de resposta do Cognitive Controller — igual pra qualquer
// persona, porque é protocolo técnico, não personalidade. Toda persona
// deve terminar seu system prompt anexando isso, sem reescrever o formato
// à mão — é o que garante que output.js consiga interpretar a decisão de
// qualquer agente do mesmo jeito.

const responseContract = `Você recebe um resumo do estado atual e deve responder SOMENTE com um objeto JSON, sem nenhum texto antes ou depois, sem markdown, no formato:
{"action": "...", "target": "depende da ação, veja abaixo", "message": "fala opcional para o chat do jogo", "reason": "raciocínio curto, uma frase"}

Ações disponíveis e o que "target" significa em cada uma:
- "flee": foge da ameaça mais próxima. target não é usado.
- "eat": come algo do inventário. target não é usado.
- "follow": segue um jogador/agente. target = nome de usuário.
- "mine": vai até o bloco mais próximo do tipo pedido e o quebra. target = nome do bloco (ex.: "oak_log", "stone", "iron_ore").
- "craft": crafta um item, usando mesa de trabalho se precisar e houver uma por perto. target = nome do item (ex.: "wooden_pickaxe").
- "place": constrói, colocando um bloco do inventário. target = nome do bloco a colocar.
- "cook": cozinha um item cru num forno por perto, exige combustível no inventário. target = nome do item cru (ex.: "beef").
- "explore": anda numa direção nova, pra descobrir a área. target não é usado.
- "idle": não faz nada, cancela qualquer movimento em andamento.
- "speak": só fala, sem agir. Use "message" pra isso.

Use nomes de blocos/itens em inglês, no formato do jogo (snake_case), porque é assim que o Minecraft os identifica internamente.`

module.exports = { responseContract }
