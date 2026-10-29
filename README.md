# OrbNOC — Monitoramento de Redes em Tempo Real

<p align="center">
  <img src="docs/img/OrbNOC_capa.png" alt="OrbNOC" width="720">
</p>

<h1 align="center">OrbNOC</h1>

<p align="center">
  Plataforma de monitoramento de redes em tempo real, desenvolvida 100% em Java.
</p>

<p align="center">
  <img alt="Java 21" src="https://img.shields.io/badge/Java-21-orange">
  <img alt="Spring Boot 3.5" src="https://img.shields.io/badge/Spring%20Boot-3.5-6db33f">
  <img alt="PostgreSQL 16" src="https://img.shields.io/badge/PostgreSQL-16-336791">
  <img alt="Licença MIT" src="https://img.shields.io/badge/Licen%C3%A7a-MIT-blue">
</p>

---

## 📡 Sobre o Projeto

O OrbNOC é uma plataforma de monitoramento de infraestrutura de rede que acompanha a disponibilidade e a latência de roteadores, switches, servidores e serviços.

Com atualização em tempo real, alertas automatizados e relatórios de SLA, a aplicação permite identificar indisponibilidades, acompanhar métricas e centralizar a visibilidade operacional em um único painel.

## ✨ Recursos

- **Monitoramento contínuo:** verificações por ICMP (ping) ou TCP (porta), com intervalos configuráveis e limite de falhas por dispositivo. Um host só é marcado como offline após um número configurado de falhas consecutivas, reduzindo falsos alarmes.
- **Atualização em tempo real:** painel, mapa e wallboard atualizados via WebSocket, sem recarregar a página.
- **Alertas inteligentes:** notificações de queda, recuperação e latência acima do limite de SLA, com confirmação de leitura e integração opcional com Telegram. Os tokens são armazenados de forma criptografada.
- **Mapa de rede:** visualizações hierárquica, radial e em grade, com zoom e movimentação.
- **Relatórios de SLA:** análises de 24 horas, 7 dias e 30 dias, com exportação para CSV e Excel e versão para impressão.
- **Diagnóstico de rede:** ferramentas de ping, traceroute, consulta DNS e teste de portas executadas pelo servidor.
- **Wallboard para NOC:** painel em tela cheia, ideal para monitores e TVs de centros de operações.
- **Controle de acesso:** perfis de administrador e usuário, com isolamento dos dispositivos de cada usuário.

## 🏗️ Arquitetura

A aplicação utiliza uma arquitetura monolítica modular, com um único serviço Spring Boot responsável pela API REST, renderização das páginas, comunicação em tempo real e monitoramento em segundo plano.

O PostgreSQL armazena os dados, enquanto threads virtuais do Java permitem executar verificações de rede concorrentes.

```text
Navegador ── HTTP/WebSocket ──► OrbNOC (Spring Boot) ── JDBC ──► PostgreSQL
                                      │
                                      ├── API REST (/api/...)
                                      ├── Interface web (Thymeleaf)
                                      ├── WebSocket (/ws)
                                      └── Monitor em segundo plano
                                           ├── Verificações ICMP/TCP
                                           ├── Coleta de métricas
                                           └── Geração de alertas
```

### 🧰 Tecnologias

| Camada | Tecnologia |
|---|---|
| Linguagem e runtime | Java 21, threads virtuais |
| Backend | Spring Boot 3.5, Spring Web, Spring JDBC (`JdbcTemplate`) |
| Interface | Thymeleaf, CSS próprio e JavaScript sem dependências |
| Banco de dados | PostgreSQL 16 |
| Migrações | Flyway |
| Comunicação em tempo real | WebSocket |
| Segurança | Argon2, cookies de sessão assinados com HS256 e AES-256-GCM |
| Exportação | Apache POI (XLSX) |
| Testes | Testcontainers e testes unitários e de integração |
| Infraestrutura | Docker, Docker Compose e Caddy |

---

## ⚙️ Como Executar

### 🐳 Com Docker (recomendado)

**1.** Clone o repositório e acesse a pasta do projeto.

```bash
git clone https://github.com/adanwilliamdev/OrbNOC.git
cd OrbNOC
```

**2.** Crie o arquivo de configuração:

```bash
cp .env.example .env
```

**3.** Edite o arquivo `.env` e configure as variáveis necessárias, incluindo `POSTGRES_PASSWORD`, `JWT_SECRET` e `ADMIN_PASSWORD`.

Para gerar um segredo seguro, utilize:

```bash
openssl rand -base64 48
```

**4.** Inicie a aplicação:

```bash
docker compose up -d --build
```

**5.** Acesse:

http://localhost:8080

Entre com as credenciais de administrador definidas no arquivo `.env`.

### 🔒 HTTPS automático com Caddy

Se você possui um domínio apontado para o servidor, configure as variáveis no `.env`:

```dotenv
SITE_ADDRESS=noc.exemplo.com
PUBLIC_URL=https://noc.exemplo.com
COOKIE_SECURE=true
```

Inicie os serviços com o perfil HTTPS:

```bash
docker compose --profile https up -d
```

### 💻 Sem Docker (desenvolvimento)

**Requisitos:**

- JDK 21
- Maven 3.9 ou superior
- PostgreSQL acessível

Configure as variáveis de ambiente:

```bash
export DATABASE_URL=jdbc:postgresql://localhost:5432/orbnoc
export DATABASE_USER=orbnoc
export DATABASE_PASSWORD=orbnoc
export ADMIN_PASSWORD='Troque123'
```

Execute a aplicação:

```bash
mvn spring-boot:run
```

#### Permissões para ICMP no Linux

Para permitir sockets de datagrama ICMP sem executar a aplicação como root:

```bash
sudo sysctl -w net.ipv4.ping_group_range="0 2147483647"
```

Se o ICMP não estiver disponível, o monitor utiliza conexões TCP como alternativa. O endpoint `/health` informa o modo ativo.

### 🌐 Compatibilidade com provedores PostgreSQL

A aplicação aceita tanto URLs JDBC convencionais quanto URLs no formato `postgresql://`, utilizado por provedores como Neon, Supabase e Render.

**Formato JDBC:**

```text
jdbc:postgresql://localhost:5432/orbnoc
```

Utilize `DATABASE_USER` e `DATABASE_PASSWORD` para informar as credenciais.

**Formato PostgreSQL:**

```text
postgresql://usuario:senha@host:5432/banco?sslmode=require
```

---

## 🔧 Configuração

A configuração é realizada por variáveis de ambiente. Consulte o arquivo [`.env.example`](.env.example).

| Variável | Padrão | Descrição |
|---|---|---|
| `JWT_SECRET` | — | Segredo para assinatura da sessão. Obrigatório em produção, com pelo menos 32 caracteres. |
| `ENCRYPTION_KEY` | Derivada de `JWT_SECRET` | Chave utilizada para proteger segredos armazenados no banco. |
| `ADMIN_USERNAME` | `admin` | Nome do administrador inicial. |
| `ADMIN_EMAIL` | — | E-mail do administrador inicial. |
| `ADMIN_PASSWORD` | Vazio | Senha do administrador inicial. |
| `ADMIN_FORCE_RESET` | `false` | Redefine a senha de um administrador existente. |
| `REGISTRATION_ENABLED` | `false` | Habilita o cadastro de usuários pela tela de login. |
| `PUBLIC_URL` | `http://localhost:8080` | URL pública da aplicação. |
| `EXTRA_ORIGINS` | — | Origens adicionais permitidas nas requisições que alteram estado. |
| `COOKIE_SECURE` | `true` em produção | Restringe o envio do cookie a conexões HTTPS. |
| `ALLOW_PRIVATE_NETWORKS` | `true` | Quando `false`, bloqueia alvos em redes privadas. |
| `ORBNOC_DEMO_SEED` | `false` | Semeia hosts de demonstração na inicialização (`SEED_DEMO_HOSTS` continua aceito). |
| `MONITOR_CONCURRENCY` | `20` | Número de verificações simultâneas. |
| `PROBE_TIMEOUT_SECONDS` | `2` | Tempo limite de cada verificação. |
| `METRICS_RETENTION_DAYS` | `14` | Retenção de amostras brutas. Agregados horários são mantidos por 400 dias. |

### ⚡ Otimizações de Performance

- **JPA/Hibernate removido.** A persistência usa `spring-boot-starter-jdbc` e `JdbcTemplate` com SQL explícito
  (`INSERT ... RETURNING id`, `JOIN`s no lugar de lazy loading). Menos classes carregadas, sem *bootstrap* do
  Hibernate e sem proxies/dirty checking: o início fica mais rápido e o consumo de memória menor.
- **`spring.main.lazy-initialization=true`.** Os beans são criados sob demanda. Flyway, os *runners*
  (`AdminBootstrap`, `DemoSeed`) e o monitor (`ApplicationReadyEvent`) continuam sendo executados na inicialização.
- **Seed controlado por propriedade.** `DemoSeed` só existe com `orbnoc.demo.seed=true` (`ORBNOC_DEMO_SEED`) e checa
  `existsByUserIdAndIp` antes de inserir.
- **Health sem banco.** `GET /health/live` responde `200` sem tocar no banco (usado pelo `HEALTHCHECK` do Docker);
  `GET /health` continua verificando banco e monitor.

| Métrica | Antes (JPA) | Depois (JDBC) |
|---|---|---|
| Tempo de boot | _medir_ | _medir_ |
| Memória (RSS após o boot) | _medir_ | _medir_ |

> Meça com o mesmo hardware e `JAVA_OPTS`: o tempo de boot aparece no log (`Started OrbNocApplication in X s`) e a
> memória com `docker stats`. Preencha a tabela com os seus números.

### Recuperação de acesso administrativo

1. Defina `ADMIN_PASSWORD` com a nova senha.
2. Configure `ADMIN_FORCE_RESET=true`.
3. Reinicie o serviço.
4. Após recuperar o acesso, remova `ADMIN_FORCE_RESET` ou redefina-o para `false` e reinicie novamente.

---

## 🛡️ Segurança

A aplicação incorpora mecanismos de segurança para proteger credenciais, sessões e operações de monitoramento.

- **Proteção de senhas:** armazenamento utilizando Argon2 e limitação de tentativas de login por IP e usuário.
- **Sessões seguras:** cookies `httpOnly`, `SameSite=Lax` e assinatura HS256.
- **Proteção CSRF:** validação de origem em requisições que alteram estado.
- **Validação de destinos:** bloqueio de loopback, link-local, endereços de metadados de nuvem, multicast e endereços reservados. O acesso a redes privadas pode ser desabilitado.
- **Execução segura de comandos:** `ping` e `traceroute` são executados sem shell, com argumentos separados e endereços previamente resolvidos e validados.
- **Cabeçalhos HTTP:** Content Security Policy (CSP), `X-Frame-Options`, `X-Content-Type-Options: nosniff` e HSTS em produção.

Consulte também a [Política de Segurança](SECURITY.md).

---

## 🧪 Desenvolvimento e Testes

Execute os testes e as verificações de compilação:

```bash
mvn verify
```

> O comando executa testes unitários e de integração. Os testes de integração exigem Docker.

Para iniciar a aplicação durante o desenvolvimento:

```bash
mvn spring-boot:run
```

### Tipos de teste

| Tipo | Classes | Comando | Requisitos |
|---|---|---|---|
| Unitários | `*Test` | `mvn test` | Nenhum serviço externo |
| Integração | `*IT` | `mvn verify` | Docker |

Os testes de integração utilizam **Testcontainers com PostgreSQL real**, usando a imagem `postgres:16-alpine`, correspondente à versão definida no `docker-compose.yml`.

Um único contêiner é compartilhado pela suíte, e o banco é limpo antes de cada teste. As verificações de rede são simuladas para evitar tráfego externo durante a execução.

Sem Docker, os testes `*IT` são ignorados localmente. No CI, eles falham quando a variável `CI` está definida.

Para executar uma classe específica de integração:

```bash
mvn verify -Dit.test=DeviceApiIT
```

Para pular os testes unitários nesse comando:

```bash
mvn verify -Dit.test=DeviceApiIT \
  -Dtest=NaoExiste \
  -Dsurefire.failIfNoSpecifiedTests=false
```

Novos testes de integração devem estender:

```text
dev.orbnoc.support.IntegrationTestBase
```

### 📁 Estrutura do Projeto

```text
src/main/java/dev/orbnoc/
├── core/           # Regras puras e testáveis
├── domain/         # Modelos de dados (POJOs simples, sem JPA)
├── repo/           # Repositórios com JdbcTemplate (SQL explícito)
├── service/        # Casos de uso, monitoramento e notificações
├── web/
│   ├── api/        # API REST
│   └── ui/         # Páginas Thymeleaf, gráficos SVG e mapa
└── ws/             # WebSocket

src/main/resources/
├── db/migration/   # Migrações Flyway
├── templates/      # Páginas e fragmentos Thymeleaf
└── static/         # CSS e JavaScript
```

Consulte o [Guia de Contribuição](CONTRIBUTING.md) para obter informações sobre como contribuir com o projeto.

---

## 📄 Licença

Este projeto está licenciado sob a **MIT License**. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.
