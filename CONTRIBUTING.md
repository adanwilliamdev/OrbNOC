# Contribuindo

Obrigado por querer ajudar!

## Ambiente

Requisitos: JDK 21, Maven 3.9+ e PostgreSQL (ou Docker). As instruções de execução estão no [README](README.md).

## Fluxo

1. Faça um fork e crie uma branch (`feature/minha-ideia`).
2. Escreva testes para o que mudar — a lógica de negócio fica em `core`, sem dependência de framework, para ser fácil de testar.
3. Rode `mvn verify` antes de abrir o pull request (inclui os testes de integração, que precisam de Docker). Para endpoints, regras de banco e monitor, prefira um `*IT` que estenda `IntegrationTestBase`.
4. Descreva o que mudou e por quê.

## Padrões

- Java 21, 4 espaços e linhas de até 120 colunas. O Spotless (`mvn spotless:check`) barra imports não usados, espaços no fim da linha e arquivo sem quebra final; `mvn spotless:apply` corrige.
- A cobertura de linhas tem piso (`jacoco.line.minimum` no `pom.xml`); código novo vem com testes.
- Mensagens para o usuário em português do Brasil.
- Alterações no banco entram como nova migração em `src/main/resources/db/migration` (`V2__...`, `V3__...`, em sequência). Nunca edite uma migração já publicada (a `V1` já está); ao publicar uma nova, registre o hash dela em `MigrationConventionsTest.PUBLICADAS`.
- Entradas externas (hosts, portas, corpo de requisições) sempre validadas; comandos do sistema só com argumentos em lista, sem shell.
- Não registre segredos (tokens, senhas) em logs.
