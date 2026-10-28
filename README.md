# Parque Inteligente – PAP

Aplicação web do projeto de estacionamento inteligente. Mostra a planta do parque, quantos lugares estão livres e ocupados e onde estão. Tem login, funciona em português e inglês e foi pensada para ser acessível a todos. Funciona no telemóvel e no computador.

*English: web app for the Smart Parking PAP project. Shows the car park plan, free and taken spaces and where they are. Has a login, works in Portuguese and English, and is built with accessibility in mind. Works on phones and computers. See "English quick start" at the end.*

## Como correr

Não é preciso instalar nada. Todos os ficheiros ficam **na mesma pasta**:

```
parque/
├── index.html
├── style.css
├── i18n.js     # traduções PT e EN
├── api.js      # dados e login (aqui se liga à base de dados)
├── app.js      # interface
└── README.md
```

1. Abre a pasta no Visual Studio Code.
2. Instala a extensão **Live Server**.
3. Botão direito em `index.html` → **Open with Live Server**.

Também funciona com duplo clique no `index.html`.

## Contas de demonstração

Enquanto não há base de dados, a app usa contas de teste (só servem para treinar):

| Conta | Palavra-passe | Papel |
| --- | --- | --- |
| admin@parque.pt | demo1234 | Administrador: pode mudar o estado de uma vaga |
| condutor@parque.pt | demo1234 | Condutor: só vê |

Quem não tem conta pode escolher **Continuar sem conta** e ver os lugares livres.

## Como está pensada a ligação à base de dados

A página **nunca fala diretamente com a base de dados**. Fala com um servidor (a API), e o servidor fala com a base de dados. Isto é obrigatório: se a página tivesse a palavra-passe da base de dados, qualquer pessoa a conseguia ver.

```
ESP32 (sensores)  ──►  Servidor (API)  ◄──►  Base de dados
                            ▲
                     Aplicação web (esta pasta)
```

Tudo o que a app lê ou escreve passa pelo ficheiro `api.js`. Para ligar ao servidor real, muda só isto no topo de `api.js`:

```js
var CONFIG = {
  apiBase: "https://o-teu-servidor/api",
  pollMs: 2000
};
```

O resto da app não muda.

### O que o servidor tem de responder

| Pedido | Quem usa | Resposta |
| --- | --- | --- |
| `POST /auth/login` com `{ "email", "password" }` | Aplicação | `{ "token": "...", "user": { "email", "name", "role" } }` |
| `GET /spots` | Aplicação (público) | `{ "spots": [ { "id": "A1", "floor": 0, "row": 0, "col": 0, "accessible": true, "occupied": false } ] }` |
| `PATCH /spots/:id` com `{ "occupied": true }` | Administrador (com token) ou ESP32 (com chave) | `204` |

`role` é `admin` ou `driver`. A planta (piso, linha e coluna de cada vaga) vem da base de dados, por isso para mudar o parque basta mudar os dados.

### Esquema da base de dados (SQL)

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,          -- nunca a palavra-passe em texto
  role          TEXT NOT NULL CHECK (role IN ('admin', 'driver'))
);

CREATE TABLE spots (
  id          TEXT PRIMARY KEY,         -- "A1"
  floor       INTEGER NOT NULL,
  row         INTEGER NOT NULL,
  col         INTEGER NOT NULL,
  accessible  BOOLEAN NOT NULL DEFAULT FALSE,
  occupied    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMP
);

CREATE TABLE spot_events (              -- histórico, útil para o relatório
  id        INTEGER PRIMARY KEY,
  spot_id   TEXT NOT NULL REFERENCES spots(id),
  occupied  BOOLEAN NOT NULL,
  at        TIMESTAMP NOT NULL
);
```

Cada vez que uma vaga muda, o servidor atualiza `spots` e acrescenta uma linha em `spot_events`. Com o histórico podes mostrar no relatório gráficos de ocupação por hora.

### O ESP32 e a base de dados

O ESP32 não escreve na base de dados. Quando um sensor muda, envia `PATCH /spots/A1` ao servidor com uma **chave de dispositivo** própria (diferente das contas de utilizadores), e o servidor guarda.

### Segurança (para escrever no relatório)

- Palavras-passe guardadas com hash (bcrypt ou argon2), nunca em texto.
- O servidor valida o `token` em cada pedido de escrita e confirma que o papel é `admin`.
- Usar `https` e limitar as origens permitidas (CORS).
- A página não guarda dados pessoais além do email e do nome.
- As contas de demonstração do `api.js` só existem para treinar e desaparecem quando se liga o servidor.

### Que tecnologia usar para o servidor

| Opção | Vantagem | Desvantagem |
| --- | --- | --- |
| Supabase ou Firebase | Já trazem login e base de dados; quase sem servidor para escrever | Dependes de um serviço externo |
| Node.js (Express) com SQLite | Tudo teu, corre no teu computador, fácil de explicar na defesa | Tens de escrever o servidor |
| PHP com MySQL | Comum nas escolas | Mais código para a parte de tempo real |

Se a escola já ensina uma destas, escolhe essa. Quando decidires, o próximo passo é escrever o servidor com os três pedidos da tabela acima.

## Mudar idiomas

Em `i18n.js`, copia o bloco `en`, muda a chave para o código do idioma (por exemplo `es`), traduz os valores e preenche `langName`. O idioma aparece sozinho no seletor.

## Acessibilidade

Ligação "saltar para o conteúdo", navegação só com teclado, foco visível, vagas com cor **e** ícone **e** texto, vista em lista para leitores de ecrã, avisos quando uma vaga muda, letra maior, alto contraste, erros do login lidos pelo leitor de ecrã, botões com pelo menos 44 px e respeito pela opção "reduzir animações".

## Testes a fazer (para o relatório)

- [ ] Telemóvel e computador, em Chrome e Firefox
- [ ] Só com teclado (Tab, Enter)
- [ ] Leitor de ecrã (NVDA no Windows, VoiceOver no iPhone)
- [ ] Alto contraste e letra maior
- [ ] Lighthouse do Chrome (acessibilidade)
- [ ] Login com dados certos e errados
- [ ] Tempo entre estacionar um carro e a app atualizar
- [ ] 5 a 10 pessoas a experimentarem e a dar opinião

## Próximos passos

- [ ] Escolher a tecnologia do servidor e da base de dados
- [ ] Escrever o servidor (login, listar vagas, mudar vaga)
- [ ] Ligar o ESP32 ao servidor
- [ ] Criar conta e recuperar palavra-passe (extra)
- [ ] Histórico de ocupação com gráfico (extra)

## English quick start

Put all files in one folder and open `index.html` with the VS Code Live Server extension (or just double-click it). Use the selector at the top to switch language. Demo accounts: `admin@parque.pt` / `demo1234` (can change a space) and `condutor@parque.pt` / `demo1234` (view only); or continue without an account. To use a real database, set `apiBase` in `api.js` to your server; it must provide `POST /auth/login`, `GET /spots` and `PATCH /spots/:id` as described above. The page never talks to the database directly.