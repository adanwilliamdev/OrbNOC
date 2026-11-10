# Migração para o Spring Boot 4.1

**Situação:** o projeto está no Spring Boot **3.5.16**, o último patch da linha 3.5, cujo suporte aberto
terminou em 30/06/2026 (não recebe mais correções). As linhas suportadas são a **4.1** (até 31/07/2027)
e a 4.0 (até 31/12/2026). O alvo é a **4.1**.

A migração é de versão maior (Spring Framework 7, Jackson 3, starters modulares) e deve ser feita numa
branch própria, com `mvn verify` e o CI rodando a cada passo. Referência oficial:
[Spring Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide).

## Checklist específico deste repositório

1. **Pré-requisito:** estar na 3.5.16 e sem avisos de depreciação (`mvn -B compile`).
2. **`pom.xml`**
   - parent para `4.1.x`;
   - `spring-boot-starter-web` → `spring-boot-starter-webmvc`;
   - Flyway passa a exigir `spring-boot-starter-flyway` (hoje há `flyway-core` + `flyway-database-postgresql`);
   - Actuator/Prometheus: conferir o starter de métricas do Micrometer no guia;
   - testes: starters de teste modulares (`spring-boot-starter-webmvc-test` etc.); `spring-boot-starter-test-classic`
     serve de ponte, mas é transitório;
   - Testcontainers 2.x: remover o `<testcontainers.version>1.21.4` fixo, trocar os artefatos
     (`testcontainers-junit-jupiter`, `testcontainers-postgresql`) e o pacote de `PostgreSQLContainer`.
3. **Jackson 3** (`com.fasterxml.jackson` → `tools.jackson`; as anotações continuam em `com.fasterxml.jackson.annotation`):
   - `RealtimeHub` e `Notifier` usam `ObjectMapper`/`JsonNode`/`JsonProcessingException` do Jackson 2;
   - `IntegrationTestBase` injeta `ObjectMapper`;
   - `Dto` só usa `@JsonProperty` (sem mudança);
   - conferir `spring.jackson.property-naming-strategy: SNAKE_CASE` e os formatos de data no `application.yml`.
4. **Testes:** `@AutoConfigureMockMvc` muda de pacote; revisar `@SpringBootTest`, `@MockitoBean` e `@TestPropertySource`.
5. **Docker:** o `Dockerfile` já usa `-Djarmode=tools extract --layers`, compatível com a 4.x.
6. **Dependabot:** vai abrir um PR da 4.x; use-o como ponto de partida.

Critério de pronto: `mvn verify` verde (incluindo ITs e o gate do JaCoCo), `docker build .` ok e
`/actuator/prometheus` respondendo na porta de gestão.
