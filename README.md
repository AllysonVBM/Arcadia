# Arcadia

Agente autônomo de IA jogando Minecraft como jogador real — com memória, personalidade, percepção do mundo e um LLM local decidindo suas ações de alto nível. Projeto de pesquisa sobre arquiteturas cognitivas para agentes embutidos em ambientes de jogo.

## Sobre o projeto

Arcadia é um experimento em construir um agente que se comporte como um jogador com "consciência de situação" dentro do Minecraft — não um bot de comandos fixos, mas um processo que percebe o mundo, mantém estado sobre ele, reage a perigo imediato sem esperar por um LLM, e usa um modelo de linguagem rodando localmente (via [Ollama](https://ollama.com)) para decidir o que fazer em um nível mais alto: conversar, seguir alguém, se afastar de uma ameaça, comer.

A pergunta de pesquisa por trás disso é simples de enunciar e difícil de responder: **dá pra sustentar um agente coerente e responsivo usando um LLM local, se a arquitetura em volta dele fizer o trabalho pesado de filtrar o que ele precisa ver?** A aposta, seguindo o paper da Altera.AL abaixo, é que sim — desde que a decisão de alto nível (LLM) fique isolada da reação imediata (código determinístico), e que o LLM receba sempre um recorte deliberado do estado do mundo, nunca o estado inteiro.

A arquitetura é adaptada do **PIANO** (*Parallel Information Aggregation via Neural Orchestration*), descrita no relatório técnico [**"Project Sid: Many-agent simulations toward AI civilization"**](https://arxiv.org/abs/2411.00114) (Altera.AL). O paper original roda de 10 a mais de 1000 agentes em um mundo de Minecraft via mod Forge + WebSocket; aqui a mesma arquitetura cognitiva foi remapeada para um único agente conectado via [mineflayer](https://github.com/PrismarineJS/mineflayer) — sem mod, sem WebSocket, direto pelo protocolo do jogo.

## Arquitetura

```
                    ┌─────────────────────────────────────────┐
                    │         Cognitive Controller             │
                    │   (loop lento, chama o LLM via Ollama)   │
                    │   lê um recorte do Agent State           │
                    │   escreve current_intent                 │
                    └───────────────┬───────────────────────────┘
                                    │
                                    ▼
┌──────────────┐   escreve   ┌──────────────┐   lê    ┌──────────────┐
│  Percepção    │ ──────────▶ │ Agent State  │ ◀────── │   Output      │
│  (mineflayer) │             │ (blackboard) │         │ fala + skills │
└──────────────┘             └──────┬───────┘         └──────────────┘
                                    ▲
                                    │ lê/age direto
                    ┌───────────────┴───────────────┐
                    │         Reflex Loop             │
                    │  (heurísticas locais, sem LLM)  │
                    │  roda a cada mudança de vida/    │
                    │  fome — nunca espera o Controller │
                    └─────────────────────────────────┘
```

Dois loops rodam em paralelo, em velocidades diferentes — o princípio de **concorrência** do PIANO:

- O **reflexo** reage a cada evento de vida/fome do jogo (até 20x/s no jogo), sem nunca chamar um LLM. Fugir de um mob ou comer com fome crítica não pode esperar uma resposta de rede.
- O **Cognitive Controller** roda a cada ~15s, lê um recorte proposital do estado (não tudo — isso é o *gargalo* do PIANO), pede ao LLM a próxima decisão, e escreve essa decisão como `current_intent`.
- O módulo de **Output** é o único ponto que fala com o jogo em nome de uma decisão — fala e ação sempre vêm da mesma fonte (`current_intent`), nunca de lugares diferentes. É essa disciplina que evita o agente dizer uma coisa e fazer outra.

### Mapa PIANO → Arcadia

| Termo do PIANO | Onde vive no Arcadia |
|---|---|
| Agent State | [`player/state/blackboard.js`](player/state/blackboard.js) |
| Heurísticas locais / concorrência | [`player/state/validators/`](player/state/validators/) + [`player/core/reflex-loop.js`](player/core/reflex-loop.js) |
| Skill Execution | [`player/skills/`](player/skills/) |
| Memory | [`player/memory/`](player/memory/) — STM em RAM + LTM em SQLite por agente |
| Cognitive Controller | [`player/core/cognitive-controller.js`](player/core/cognitive-controller.js) |
| Output / coerência | [`player/core/output.js`](player/core/output.js) |
| Social Awareness | parcial — agentes só se conhecem ouvindo o chat um do outro in-game, nunca por config (ver "Compartilhamento de conhecimento" abaixo) |
| Goal Generation | fora de escopo — dependeria de Social Awareness completo |

## Estrutura de pastas

```
player/
├── connect.js                    # bootstrap: cria o bot e liga todos os módulos
├── launcher.js                   # sobe N processos independentes (um por identidade)
├── server_cfg.js                 # host/porta/versão do servidor Minecraft
├── config/
│   ├── player_cfg.js             # roster: identidade + porta de dashboard/viewer
│   ├── agent_cfg.js              # qual identidade este processo roda (env AGENT_NAME)
│   ├── scenario_cfg.js           # qual cenário está ativo (env SCENARIO_ID)
│   └── llm_cfg.js                # host/modelo/temperatura do Ollama
├── identity/
│   ├── index.js                  # carrega a persona certa pra identidade configurada
│   ├── responseContract.js       # formato JSON de resposta, igual pra qualquer persona
│   └── personas/
│       ├── pepper.js             # curiosa, direta, fala pouco
│       ├── atena.js              # cautelosa, sociável, prioriza avisar os outros
│       ├── milo.js               # metódico, prático, foca em construir/organizar
│       ├── vex.js                # aventureiro, tolera mais risco que a média
│       └── sol.js                # cuidadosa com o bem-estar do grupo, compartilha recursos
├── scenarios/
│   ├── isolado.js                # caso 1: um agente sozinho
│   ├── dupla.js                  # caso 2: dois agentes juntos
│   └── quinteto.js               # caso 3: cinco agentes juntos
├── state/
│   ├── blackboard.js             # Agent State: Map com get/set/has/delete
│   ├── reflexLock.js             # trava de sobrevivência contra o Controller
│   └── validators/
│       ├── status.js             # isHealthCritical, isHungry
│       └── threat.js             # detecção de mob hostil por perto
├── perception/
│   ├── agentHealth.js            # grava vida/fome no Agent State
│   ├── agentPosition.js          # grava posição no Agent State
│   └── inventoryState.js         # grava inventário no Agent State
├── skills/
│   ├── flee.js                   # foge da ameaça mais próxima
│   ├── eat.js                    # come o primeiro item comestível do inventário
│   ├── follow.js                 # segue um jogador continuamente
│   ├── goTo.js                   # vai até uma coordenada (usada pela área de spawn do cenário)
│   ├── mine.js                   # acha e quebra um bloco; equipa a ferramenta certa quando ela é exigida
│   ├── craftItem.js              # crafta um item; faz e coloca mesa sozinho se souber "place"
│   ├── placeBlock.js             # constrói: coloca um bloco do inventário
│   ├── cookItem.js               # cozinha num forno (exige combustível + item cru)
│   ├── explore.js                # anda numa direção aleatória, pra descobrir área nova
│   ├── hunt.js                   # caça o animal mais próximo, pra conseguir carne crua
│   ├── fight.js                  # enfrenta a ameaça hostil mais próxima, recua se a vida cair
│   ├── bow.js                    # atira com arco e flecha na ameaça mais próxima
│   ├── plant.js                  # planta uma semente numa terra arável já existente
│   ├── swim.js                   # vai deliberadamente até a água mais próxima e atravessa
│   └── teach.js                  # oferece ensinar uma skill conhecida a outro agente
├── memory/
│   ├── workingMemory.js          # STM: buffer circular de eventos recentes (RAM)
│   ├── db.js                     # abre/cria data/<agente>/memory.sqlite (node:sqlite)
│   ├── longTermMemory.js         # LTM: remember/recall, score por recência+relevância+importância
│   ├── profile.js                # fatos de identidade persistentes (ex.: profissão)
│   ├── skills.js                 # quais skills "gated" o agente conhece, prática, kit inicial
│   ├── currency.js               # moeda por agente, usada só pra pagar por skills ensinadas
│   └── consolidate.js            # loop lento que resume STM -> LTM via LLM
├── llm/
│   ├── ollamaClient.js           # cliente mínimo do endpoint /api/chat do Ollama
│   └── embeddings.js             # cliente mínimo do endpoint /api/embeddings do Ollama
├── dashboard/
│   ├── server.js                 # HTTP + WebSocket, transmite o estado do agente em tempo real
│   ├── viewer.js                 # liga o prismarine-viewer (visão 3D do que o bot vê)
│   └── index.html                # o painel em si — aberto no navegador
└── core/
    ├── reflex-loop.js            # heurísticas locais, sem LLM
    ├── cognitive-controller.js   # loop que chama o LLM e decide current_intent
    ├── profession-reflection.js  # reflexão lenta sobre a LTM, decide/reafirma profissão
    └── output.js                 # único ponto que executa current_intent
```

## Como rodar

### Pré-requisitos

- **Node.js 22.5+** (usa `fetch` nativo e o módulo nativo `node:sqlite` — verificado no Node 24; nenhuma versão do projeto usa driver de banco como dependência externa)
- Um servidor Minecraft acessível (o agente conecta como cliente, via protocolo — não precisa de mod nenhum instalado no servidor)
- `canvas` (dependência do `prismarine-viewer`, usada pra visão 3D) baixa um binário pré-compilado no `npm install` na maioria das plataformas; se falhar na sua, é a única dependência do projeto que pode exigir toolchain nativo (Python + compilador C++)
- [Ollama](https://ollama.com) instalado e rodando localmente, com um modelo de chat e um de embeddings já baixados:

```bash
ollama pull llama3.1
ollama pull nomic-embed-text
```

### Instalação

```bash
npm install
```

### Configuração

Edite [`player/server_cfg.js`](player/server_cfg.js) com o host/porta/versão do seu servidor. Opcionalmente, copie `.env.example` para `.env` para trocar o modelo, o endpoint do Ollama ou a identidade:

```bash
cp .env.example .env
```

### Rodando

```bash
npm start
```

Sem nada configurado, o agente sobe como `Pepper` — a primeira identidade de [`player_cfg.js`](player/config/player_cfg.js). Ele começa a reagir sozinho a vida/fome crítica (reflexo) e, ~15s depois de nascer, começa a tomar decisões de alto nível via LLM (Cognitive Controller), com a personalidade definida em [`identity/personas/pepper.js`](player/identity/personas/pepper.js).

### Trocando de identidade

Cada identidade tem sua própria personalidade (`identity/personas/<nome>.js`) e sua própria LTM (`data/<nome>/memory.sqlite`) — processos diferentes, memórias diferentes, sem nada compartilhado:

```bash
AGENT_NAME=Atena npm start
```

Pra adicionar uma identidade nova: criar `identity/personas/<nome>.js` (copiando o formato de `pepper.js`), registrar em `identity/index.js`, e incluir uma entrada em `config/player_cfg.js` com nome + porta de dashboard + porta de viewer (precisam ser únicas por identidade). `agent_cfg.js` recusa subir (erro explícito) se `AGENT_NAME` não estiver no roster.

### Rodando múltiplos agentes ao mesmo tempo

```bash
npm run swarm                  # todo mundo do roster
npm run swarm -- Pepper        # só o caso isolado
npm run swarm -- Pepper Atena  # a dupla
```

O `launcher.js` sobe um processo Node **de verdade** por identidade (`child_process.fork`, não threads) — cada um com seu próprio module registry, seu próprio Agent State, sua própria LTM. Isolamento por construção, não por convenção: o lançador só passa `AGENT_NAME` pra cada filho, nunca informação sobre os outros agentes. Um agente só fica sabendo que o outro existe se de fato se encontrarem no jogo (chat ouvido, entidade vista) — nada nisso passa pelo lançador.

Cada agente sobe seu próprio dashboard/viewer na porta definida em `player_cfg.js` — hoje é preciso abrir uma aba por agente (`localhost:4000`, `localhost:4001`, ...); um painel único agregando todos é um passo natural mais pra frente, ainda não construído.

`Ctrl+C` no lançador manda `SIGINT` pra cada filho, que se desconecta do servidor antes de sair — sem isso o bot fica "fantasma" logado por alguns segundos.

### Cenários de teste

Os 3 casos de teste do projeto (`player/scenarios/`), cada um com área de spawn por agente e uma lista de objetivos:

| Cenário | Agentes | Objetivo do caso |
|---|---|---|
| `isolado` | Pepper | 1 agente sobrevivendo sozinho |
| `dupla` | Pepper, Atena | 2 agentes na mesma área |
| `quinteto` | Pepper, Atena, Milo, Vex, Sol | 5 agentes na mesma área |

```bash
SCENARIO_ID=isolado npm run swarm
SCENARIO_ID=quinteto npm run swarm
```

Com um cenário ativo, cada agente vai automaticamente até a própria área de spawn ao nascer (`skills/goTo.js`), e os objetivos entram no contexto que o Cognitive Controller lê a cada decisão — junto com um lembrete explícito de que sobrevivência vem antes de qualquer objetivo. **Objetivos são informativos, não verificados automaticamente ainda** — não existe hoje um motor que detecte "abrigo construído" sozinho; isso fica pra um passo futuro de goals/subgoals de verdade.

A prioridade de sobrevivência agora é uma trava de código, não só uma instrução de prompt: `state/reflexLock.js` é adquirida sempre que o reflexo age (fugir/comer), e `core/output.js` recusa despachar ações de movimento do Cognitive Controller enquanto ela estiver ativa — a fala ainda passa, só a ação física é bloqueada.

### Ações disponíveis pro Cognitive Controller

Além de `flee`/`eat`/`follow`/`idle`/`speak`, o Controller pode decidir:

| Ação | O que faz | `target` |
|---|---|---|
| `mine` | Acha o bloco mais próximo do tipo pedido (dentro do que já foi explorado) e quebra | nome do bloco, ex. `oak_log`, `stone`, `iron_ore` |
| `craft` | Crafta um item — usa mesa de trabalho se a receita exigir; faz e coloca uma sozinho se souber `place` e tiver material | nome do item, ex. `wooden_pickaxe` |
| `place` | Constrói: coloca um bloco do inventário em cima de onde o agente está pisando | nome do bloco a colocar |
| `cook` | Cozinha um item cru num forno por perto (exige combustível no inventário) | nome do item cru, ex. `beef` |
| `explore` | Anda numa direção nova, pra sair da área já vista | não usado |
| `hunt` | Caça o animal mais próximo (vaca, porco, galinha...), pra conseguir carne crua | não usado |
| `fight` | Enfrenta a ameaça hostil mais próxima em vez de fugir — recua sozinho se a vida ficar crítica no meio da luta | não usado |
| `bow` | Atira com arco e flecha na ameaça mais próxima (exige arco + flecha no inventário) | não usado |
| `plant` | Planta uma semente do inventário numa terra arável já existente | não usado |
| `swim` | Vai deliberadamente até a água mais próxima e atravessa | não usado |
| `teach` | Oferece ensinar uma skill que já sabe a outro agente, por um preço que ele mesmo decide | nome de quem recebe a oferta (+ `skill` e `price`) |

Cada decisão do Controller já recebe uma lista de **recursos reconhecidos nas proximidades** (`oak_log`, `stone`, `crafting_table`, `furnace`, etc. — o que `bot.findBlock` encontrar num raio de 24 blocos), pra ele ter opções concretas em vez de chutar um nome de bloco às cegas.

`place` é um primitivo — coloca um bloco por vez. "Construir um abrigo" continua sendo várias decisões em sequência, não uma macro única.

### Skills aprendidas, moeda e ensino entre agentes

`mine`, `craft`, `place`, `cook`, `hunt`, `fight`, `bow`, `plant` e `swim` são **"gated"** — não é porque a skill existe no código que qualquer agente já sabe usá-la. Sobrevivência (`flee`, `eat`, `follow`, `explore`, `idle`, `speak`) nunca é gated, por design: não pode depender de aprendizado.

**A ordem natural de progressão importa de verdade, porque é a mecânica real do Minecraft.** Pedra e minério só soltam item se houver uma picareta equipada — minerar com a mão só quebra o bloco, sem drop. Madeira não exige nenhuma ferramenta. `mine.js` já verifica isso (recusa minerar pedra/minério sem ferramenta, em vez de fingir sucesso) e o contrato de resposta explica essa ordem pro Controller — mas ainda depende da LLM escolher seguir essa lógica; não há um planejador forçando "madeira antes de pedra".

- **Kit inicial aleatório**: na primeira vez que um agente sobe (nunca de novo depois disso), sorteia 2 das skills gated como já conhecidas. As outras precisam ser aprendidas.
- **Aprender praticando**: se o Controller decide uma ação que o agente ainda não sabe, ele tenta mesmo assim — cada tentativa tem uma chance de dar certo que cresce com o número de tentativas (`memory/skills.js`), até destravar de vez na 8ª. Sem saber, uma tentativa malsucedida não executa a ação de verdade, só soma progresso.
- **Ensinar (e cobrar por isso)**: cada agente tem uma moeda própria, persistida (`memory/currency.js`, saldo inicial 10). Um agente que já sabe uma skill pode oferecer ensiná-la a outro, decidindo o próprio preço — **não existe preço fixo no código**, cada LLM decide quanto cobrar.

O ensino não usa nenhum canal entre processos (não existe nenhum) — é inteiramente mediado pelo chat do jogo, com um protocolo fixo e determinístico (não interpretado por LLM, pra não depender de um modelo pequeno "entender" uma negociação em texto livre):

1. O professor decide `teach` → manda `!teach <skill> <preço> <destinatário>` no chat.
2. Só quem está fisicamente por perto (raio de 16 blocos) processa a oferta — é isso que obriga os agentes a "se encontrarem" pra negociar.
3. Se o aluno já sabe a skill, recusa. Se não tem saldo, recusa. Se tem: debita o próprio saldo, aprende a skill (`acquired_via: 'taught'`), e responde `!teach-accept <skill> <preço> <professor>`.
4. O professor, ao ver essa confirmação, credita o próprio saldo — só então, nunca antes.

Isso também é o mecanismo de "compartilhar conhecimento" do projeto: não existe nenhum canal fora do jogo. Toda skill nova também anuncia o que fez (`"Minerei oak_log."`), e qualquer agente por perto ouve isso naturalmente — vira contexto na working memory de quem ouviu, e pode virar LTM na próxima consolidação.

### Comandos de chat (debug manual)

| Comando | O que faz |
|---|---|
| `!follow` | Segue quem digitou o comando |
| `!position` | Reporta a posição atual |
| `!inventory` | Lista o inventário |
| `!life` | Reporta a vida atual |
| `!hunger` | Reporta a fome atual |
| `!skills` | Lista as skills gated que o agente já sabe |
| `!currency` | Reporta o saldo de moeda atual |

Esses comandos são atalhos diretos pra debug — não passam pelo Cognitive Controller nem pelo `current_intent`. `!teach` e `!teach-accept` também trafegam pelo chat, mas não são comandos de debug — são o protocolo de ensino entre agentes (ver acima), e o próprio código os reconhece e processa.

### Painel de observação (dashboard)

Assim que o agente nasce no mundo, dois servidores locais sobem junto com ele — nenhum dos dois precisa ser iniciado à parte:

- **`http://localhost:4000`** — o painel: vida/fome com barra, posição, ameaça por perto, a decisão atual do Cognitive Controller (`current_intent` + `reason`), a última skill executada, inventário, chat do Minecraft em tempo real, memória de trabalho recente, e uma barra por skill gated mostrando se já sabe, quantas tentativas de prática já fez (de 8), moeda e quantas memórias de longo prazo já acumulou — é o jeito mais rápido de checar se um agente está progredindo de verdade ou só girando em roda. Tudo via WebSocket, atualizado a cada segundo (chat é instantâneo).
- **`http://localhost:3007`** — visão 3D do que o agente está vendo ([prismarine-viewer](https://github.com/PrismarineJS/prismarine-viewer)), embutida no próprio painel: informe a porta (já vem pré-preenchida) e clique em Conectar.

Com múltiplos agentes rodando via `npm run swarm`, cada um sobe seu próprio dashboard na porta configurada em `player_cfg.js` — o frontend já foi escrito pra renderizar quantos agentes reportarem a ele (chave por nome), mas hoje isso significa abrir uma aba por porta; um relay agregando tudo numa página só ainda não existe.

### Memória de longo prazo (LTM)

Cada agente tem seu próprio banco em `data/<nome>/memory.sqlite` (pasta ignorada pelo git — é estado de execução, não código). Não existe coluna ou tabela compartilhada entre agentes: **o arquivo em si é o limite de isolamento**. Um agente só grava algo sobre outro quando percebe isso de fato no jogo (ouviu no chat, por exemplo) — nunca por configuração.

- **Escrita**: a cada ~2min, `consolidate.js` manda os eventos recentes (working memory) pra LLM e pede pra decidir o que vale virar memória de longo prazo, com uma nota de importância de 1 a 10. A maioria dos ciclos não gera memória nenhuma — isso é esperado.
- **Leitura**: `longTermMemory.recall(agente, consulta)` pontua cada memória por **recência + relevância + importância** (mesma fórmula de Park et al., *Generative Agents*, 2023) e devolve as mais relevantes. O Cognitive Controller já usa isso automaticamente a cada decisão.
- **Relevância** é calculada por similaridade de cosseno entre embeddings (`nomic-embed-text` via Ollama) — sem extensão de banco vetorial; na escala de memória de um agente isso é rápido o suficiente calculado em JS puro.

**Se `ollama pull nomic-embed-text` nunca foi rodado**, toda escrita e leitura de LTM falha silenciosamente (o erro é só logado no console, pra não travar o agente) — o contador de memórias no painel fica em 0 pra sempre, mesmo depois de horas rodando. Vale checar `ollama list` de vez em quando pra confirmar que o modelo de embeddings está mesmo instalado, não só o de chat.

### Profissão emergente

A cada ~10min (bem mais devagar que qualquer outro loop do projeto), `core/profession-reflection.js` pega uma amostra ampla da própria LTM — não é busca por relevância a uma pergunta específica, é uma visão geral da trajetória — e pergunta à LLM se algo mudou o suficiente pra decidir ou reafirmar uma profissão (`"minerador"`, `"fazendeiro"`, o que fizer sentido pelo que o agente realmente viveu). A decisão fica persistida em `data/<nome>/memory.sqlite` (tabela `profile`, sobrevive a restart) e passa a aparecer no contexto que o Cognitive Controller lê a cada decisão — e no painel de observação.

Sem memória nenhuma na LTM, a reflexão não chama a LLM à toa — só roda quando há alguma coisa pra de fato refletir sobre.

## Limitações conhecidas (honestidade de pesquisa)

- **`swim` não muda a política geral de movimento.** É uma ação explícita (vai até a água e atravessa) — as outras skills continuam evitando água pelo custo padrão do `Movements`, não existe ainda uma noção de "não sei nadar, então evito água em qualquer situação".
- **`plant` não sabe preparar terra.** Só planta em farmland já existente — tilling (enxada + terra) não está implementado.
- **`hunt`/`fight` têm uma rede de segurança de 20 ataques**, não perseguem o alvo indefinidamente se ele fugir pra longe ou se esconder.
- **`!teach` confia no aluno.** O aprendizado só é creditado pro professor quando o aluno manda `!teach-accept` — mas nada impede, em teoria, alguém editar o código do próprio agente pra mandar essa mensagem sem ter pago de verdade. Pra um protótipo de pesquisa isso é aceitável; não é um sistema à prova de má-fé entre participantes adversariais.
- **Chat é global no servidor vanilla, não por proximidade real do jogo.** O protocolo de ensino aplica seu próprio filtro de distância (16 blocos) em código, mas isso é uma aproximação nossa — não uma restrição de fato do canal de chat do Minecraft.
- **STM ainda é ingênua.** `workingMemory.js` é um buffer circular em RAM sem nenhuma lógica de resumo — a consolidação lê ele cru.
- **Sem Action Awareness ainda.** As skills gravam `last_action` com o resultado esperado, mas nada compara isso com o que de fato aconteceu no jogo — o agente pode "achar" que comeu ou fugiu com sucesso sem confirmação.
- **Confiabilidade do JSON depende do modelo local.** Modelos pequenos rodando via Ollama nem sempre respeitam o formato JSON pedido, mesmo com `format: "json"` — vale tanto pro Controller quanto pra consolidação de memória. Quando isso acontece, o módulo loga o erro e pula aquele ciclo — não derruba o processo, mas também não decide/lembra nada naquele tick.
- **Sem índice vetorial.** `recall()` calcula similaridade de cosseno contra *todas* as memórias do agente a cada chamada — funciona bem até a casa de milhares de entradas; se um agente viver muito tempo isso pode precisar de um índice de verdade (sqlite-vec ou similar) mais pra frente.
- **Sem forma de conseguir comida do zero.** `mine`/`craft`/`cook` cobrem madeira, pedra, minério e cozimento — mas não há skill de caçar (atacar mob) nem plantar/colher, então se o inventário nascer vazio e não houver comida achável por aí, o agente pode ficar preso indefinidamente no reflexo de fome sem conseguir resolver a causa. É a lacuna mais importante que resta pros objetivos de "fonte de comida renovável" dos cenários.
- **Objetivos são informativos, não verificados.** Mesmo com a skill existindo, não há detecção automática de "objetivo concluído" — não há motor de goals/subgoals de verdade ainda.
- **`place` é um primitivo, não um planejador.** Constrói um bloco por vez, sempre em cima de onde o agente está pisando — "abrigo" ainda depende do Controller encadear várias chamadas sozinho, sem nenhuma orientação de layout.
- **Dashboard sem agregação entre processos.** Com `npm run swarm`, cada agente sobe seu próprio painel numa porta separada — hoje é preciso uma aba por agente, não existe visão única.
- **Social Awareness e Goal Generation** (PIANO) dependem de 2+ agentes no mesmo mundo interagindo de fato — ainda não implementados. O isolamento de LTM e o lançador multiagente já foram construídos pensando nisso: nenhum agente deve saber da existência do outro além do que percebe no próprio jogo.
- **Servidores com mods**: o mineflayer enxerga o mundo pelo protocolo vanilla via [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) — blocos/entidades customizados por mods que não estão nesse registro podem confundir o pathfinder (custo de movimento incorreto, dificuldade pra pular certos blocos).

## Roteiro

O projeto segue um roteiro em fases, cada uma só começando quando a anterior sustenta o agente sem cair:

0. **Base de conexão estável** — reconexão automática, log estruturado *(parcial)*
1. **Camada reflexa** — heurísticas de sobrevivência sem LLM ✅
2. **Skill Execution formal** — biblioteca de ações com contrato de expectativa *(parcial)*
3. **Cognitive Controller** — LLM local (Ollama) decidindo a ação de alto nível ✅
4. **Painel de observação** — dashboard web + visão 3D em tempo real ✅
5. **LTM isolada por agente** — memória de longo prazo persistida, sem conhecimento cross-agente a priori ✅
6. **Personas por agente** — uma identidade/personalidade própria por processo ✅
7. **Lançador multiagente** — N processos independentes, cada um sem saber da existência dos outros até se encontrarem no jogo ✅
8. **Cenários com objetivos** — configuração por caso de teste (isolado / dupla / quinteto), sobrevivência como prioridade inegociável acima de qualquer objetivo ✅
9. **Profissão emergente** — reflexão de baixa frequência sobre a LTM do próprio agente, decidindo/reafirmando uma profissão ✅

## Referências

- Altera.AL — [*"Project Sid: Many-agent simulations toward AI civilization"*](https://arxiv.org/abs/2411.00114) (arXiv:2411.00114)
- Park et al. — [*"Generative Agents: Interactive Simulacra of Human Behavior"*](https://arxiv.org/abs/2304.03442) (arXiv:2304.03442) — inspiração para a recuperação de memória por recência + relevância + importância na LTM
- [mineflayer](https://github.com/PrismarineJS/mineflayer) / [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) / [prismarine-viewer](https://github.com/PrismarineJS/prismarine-viewer)
- [Ollama](https://ollama.com)

## Licença

ISC
