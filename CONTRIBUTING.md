# Contribuindo

Obrigado por querer ajudar!

## Ambiente

Requisitos: JDK 21, Maven 3.9+ e PostgreSQL (ou Docker). As instruções de execução estão no [README](README.md).

## Fluxo

1. Faça um fork e crie uma branch (`feature/minha-ideia`).
2. Escreva testes para o que mudar — a lógica de negócio fica em `core`, sem dependência de framework, para ser fácil de testar.
3. Rode `mvn verify` antes de abrir o pull request.
4. Descreva o que mudou e por quê.

## Padrões

- Java 21, formatação padrão do IntelliJ/Google Java Style, sem imports não usados.
- Mensagens para o usuário em português do Brasil.
- Alterações no banco entram como nova migração em `src/main/resources/db/migration` (nunca edite uma migração já publicada).
- Entradas externas (hosts, portas, corpo de requisições) sempre validadas; comandos do sistema só com argumentos em lista, sem shell.
- Não registre segredos (tokens, senhas) em logs.
