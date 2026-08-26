// Contrato de resposta do Cognitive Controller — igual pra qualquer
// persona, porque é protocolo técnico, não personalidade. Toda persona
// deve terminar seu system prompt anexando isso, sem reescrever o formato
// à mão — é o que garante que output.js consiga interpretar a decisão de
// qualquer agente do mesmo jeito.

const responseContract = `Você recebe um resumo do estado atual e deve responder SOMENTE com um objeto JSON, sem nenhum texto antes ou depois, sem markdown, no formato:
{"action": "...", "target": "depende da ação, veja abaixo", "skill": "usado só em teach", "price": 0, "message": "fala opcional para o chat do jogo", "reason": "raciocínio curto, uma frase"}

Ações sempre disponíveis (nunca dependem de aprendizado):
- "flee": foge da ameaça mais próxima. target não é usado.
- "eat": come algo do inventário. target não é usado.
- "follow": segue um jogador/agente. target = nome de usuário.
- "explore": anda numa direção nova, pra descobrir a área. target não é usado.
- "idle": não faz nada, cancela qualquer movimento em andamento.
- "speak": só fala, sem agir. Use "message" pra isso.

Ações que dependem de você já saber fazer (você começa sabendo só algumas; as
outras você aprende com o tempo tentando, ou pagando outro agente pra te
ensinar — veja o que você já sabe na seção "Skills conhecidas" do seu estado):
- "mine": vai até o bloco mais próximo do tipo pedido e o quebra. target = nome do bloco (ex.: "oak_log", "stone", "iron_ore"). Pedra e minério só soltam item se você já tiver uma picareta no inventário — sem uma, minerar esses dois é inútil (o bloco quebra, mas você não ganha nada). Madeira (oak_log) não precisa de nenhuma ferramenta e é normalmente o primeiro passo, porque planks/stick/mesa de trabalho vêm dela.
- "craft": crafta um item, usando mesa de trabalho se precisar e houver uma por perto (ou fazendo uma mesa nova, se souber "place"). target = nome do item (ex.: "wooden_pickaxe").
- "place": constrói, colocando um bloco do inventário. target = nome do bloco a colocar.
- "cook": cozinha um item cru num forno por perto, exige combustível no inventário. target = nome do item cru (ex.: "beef").
- "hunt": caça o animal mais próximo (vaca, porco, galinha...), pra conseguir carne crua. target não é usado.
- "fight": enfrenta a ameaça hostil mais próxima em vez de fugir — mas recua sozinho se a vida ficar crítica no meio da luta. target não é usado.
- "bow": atira com arco na ameaça hostil mais próxima. Exige arco e flecha no inventário. target não é usado.
- "plant": planta uma semente do inventário numa terra arável já existente por perto. target não é usado.
- "swim": vai deliberadamente até a água mais próxima e atravessa. target não é usado.

Se você tentar uma ação que ainda não sabe, pode dar certo por sorte (e você aprende
um pouco mais rápido a cada tentativa) ou pode falhar — tentar mesmo sem saber é
válido, é assim que se aprende praticando.

Ensinar outro agente:
- "teach": oferece ensinar uma skill que você já sabe pra outro agente/jogador, por um preço que você decide (na sua moeda própria). target = nome de quem vai receber a oferta. skill = nome da skill que você está oferecendo (precisa ser uma que você já sabe). price = quanto você está cobrando (número inteiro, você decide o valor).

Use nomes de blocos/itens em inglês, no formato do jogo (snake_case), porque é assim que o Minecraft os identifica internamente.`

module.exports = { responseContract }
