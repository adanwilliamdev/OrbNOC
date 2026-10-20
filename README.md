# OrbNOC — Network Operations Center

Sistema Full Stack de monitoramento e gestão de redes, desenvolvido para equipes de **NOC (Network Operations Center)**. O OrbNOC oferece uma interface moderna em Dark Mode, monitoramento automatizado, ferramentas de diagnóstico de rede e gerenciamento de incidentes em uma única plataforma.

## 🚀 Stack Tecnológica

### Backend
- **Java 17+**
- **Spring Boot 3.3.5**
- **Spring Data JPA** — persistência de dados com H2 em memória no ambiente de desenvolvimento
- **Spring Web** — desenvolvimento de APIs REST
- **Java HttpClient e InetAddress** — monitoramento HTTP e ICMP
- **Spring Scheduling** — execução automática das rotinas de monitoramento a cada 30 segundos

### Frontend
- **Angular 19** — aplicação baseada em Standalone Components
- **TypeScript 5.6**
- **RxJS** — gerenciamento de fluxos assíncronos e atualização periódica dos dados
- **CSS3** — design system próprio, com variáveis, glassmorphism e animações SVG
- **Google Fonts** — Plus Jakarta Sans e JetBrains Mono

## ✨ Funcionalidades

### 🖥️ Dashboard e monitoramento

- **KPIs:** disponibilidade, dispositivos online/offline e latência média, mínima e máxima.
- **Gráficos Sparkline:** visualização da latência com atualizações a cada 30 segundos.
- **Timeline de 24 horas:** histórico visual de estabilidade com tooltips interativos.
- **Alertas sonoros:** notificações no navegador quando um dispositivo fica indisponível, respeitando o estado de manutenção.
- **Monitoramento híbrido:** verificação de conectividade ICMP para endereços IP e monitoramento HTTP para sites e APIs.

### 🌐 Topologia de rede

- **Mapa interativo:** representação visual do núcleo da rede (Core) e dos dispositivos conectados, utilizando SVG.
- **Glassmorphism:** elementos visuais com efeitos de vidro e iluminação.
- **Conexões animadas:** linhas com animações que representam o fluxo de dados entre os dispositivos.

### 🛠️ Ferramentas de diagnóstico

Interface de terminal web com visual inspirado em terminais macOS, cursor animado e execução de ferramentas de diagnóstico pelo backend.

- **Ping e Traceroute:** testes de conectividade e análise de rotas.
- **DNS e WHOIS:** resolução de nomes e consulta de informações sobre domínios.
- **Port Scanner:** verificação de portas selecionadas em endereços remotos.
- **Network Discovery:** varredura de sub-redes para identificação de dispositivos ativos.

> **Nota de segurança:** utilize as ferramentas de diagnóstico e varredura somente em redes e sistemas para os quais você tenha autorização.

### 📋 Gestão de ativos e incidentes

- **Inventário de ativos:** cadastro de hostname, endereço IP ou URL, tipo de dispositivo, localização e tags.
- **Janela de manutenção:** silenciamento de alertas para dispositivos em manutenção programada.
- **Gestão de incidentes:** abertura e resolução de ocorrências com níveis de severidade.
- **Audit Trail:** registro de eventos do sistema com indicadores visuais para os níveis `INFO`, `WARN` e `ERROR`.

### 🔒 Segurança e experiência do usuário

- **Autenticação:** telas de login e cadastro com proteção de rotas por `AuthGuard`.
- **Controle de acesso (RBAC):** restrição da interface de exclusão de dispositivos a administradores.
- **Busca global:** pesquisa de dispositivos, incidentes e telas com o atalho `Ctrl + K`.
- **Modo TV (Wallboard):** painel em tela cheia, com atualização automática e tipografia ampliada, ideal para monitores de acompanhamento. Pressione `ESC` para sair.

## 🏃 Como executar o projeto

### Pré-requisitos

Antes de começar, instale:

- [Java JDK 17 ou superior](https://adoptium.net/)
- [Apache Maven 3.9 ou superior](https://maven.apache.org/)
- [Node.js 18 ou superior](https://nodejs.org/)
- [Angular CLI](https://angular.dev/tools/cli)

### 1. Clonar o repositório

```bash
git clone https://github.com/adanwilliamdev/OrbNOC.git
cd OrbNOC
```

### 2. Executar o backend

Na raiz do projeto, execute:

```bash
cd backend
mvn spring-boot:run
```

A API estará disponível em:

`http://localhost:8080`

**Console do banco H2**

`http://localhost:8080/h2-console`

Configurações de conexão para o ambiente de desenvolvimento:

| Propriedade | Valor |
|---|---|
| JDBC URL | `jdbc:h2:mem:orbnocdb` |
| User Name | `sa` |
| Password | Deixe em branco |

> As configurações acima pressupõem que o backend esteja configurado para utilizar esses parâmetros no ambiente local.

### 3. Executar o frontend

Abra outro terminal e execute:

```bash
cd frontend
npm install
npm start
```

A interface estará disponível em:

`http://localhost:4200`

Caso o script `start` não esteja definido no `package.json`, utilize o comando configurado no projeto, como `ng serve`.

### 4. Configuração inicial

1. Acesse a aplicação pelo navegador.
2. Na tela de login, selecione **Cadastre-se** e crie uma conta.
3. Entre com suas credenciais.
4. Acesse **Dispositivos** e cadastre os primeiros ativos.
5. Retorne ao Dashboard e aguarde o ciclo de monitoramento para visualizar os resultados.

Exemplos de dispositivos:

| Hostname | Endereço | Tipo |
|---|---|---|
| Google DNS | `8.8.8.8` | `SERVER` |
| GitHub API | `https://api.github.com` | `SERVER` |

## 📂 Estrutura do projeto

```text
OrbNOC/
├── backend/
│   ├── src/
│   │   └── main/
│   │       └── java/com/orbnoc/
│   │           ├── controller/   # Endpoints REST
│   │           ├── model/        # Entidades JPA
│   │           ├── repository/   # Repositórios Spring Data
│   │           └── service/      # Serviços e monitoramento
│   └── pom.xml
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/       # Dashboard, Devices, Tools etc.
│   │   │   ├── services/         # Serviços e guards
│   │   │   ├── app.routes.ts     # Configuração de rotas
│   │   │   └── app.config.ts     # Configuração da aplicação
│   │   └── styles.css            # Design system global
│   └── package.json
│
└── README.md
```

## 🗺️ Roadmap

- [ ] Implementar integração com Telegram e Slack para notificações de incidentes.
- [ ] Adicionar métricas de CPU e memória por meio de SNMP e integrações com ferramentas como Zabbix ou Prometheus.
- [ ] Gerar relatórios de SLA nos formatos PDF e CSV.
- [ ] Implementar recursos de recuperação automática de serviços (*Self-Healing*) por SSH.
- [ ] Substituir o banco H2 por PostgreSQL para ambientes de produção.

## 🎯 Objetivo do projeto

O OrbNOC foi desenvolvido como um projeto de portfólio para demonstrar conhecimentos em **Java, Spring Boot, Angular, APIs REST, monitoramento de redes, diagnóstico de conectividade e desenvolvimento Full Stack**.

A proposta é reunir ferramentas comuns à rotina de equipes de infraestrutura e operações de rede em uma interface centralizada, organizada e visualmente consistente.
