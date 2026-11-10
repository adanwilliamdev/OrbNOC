package dev.orbnoc.repo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Guarda as regras de migração do Flyway sem precisar de banco: nomes no padrão, versões
 * sequenciais sem buracos e migrações já publicadas imutáveis. Todo ajuste de schema entra como
 * uma nova versão (V2, V3, ...), nunca como edição de uma existente.
 */
class MigrationConventionsTest {

    private static final Path DIR = Path.of("src/main/resources/db/migration");
    private static final Pattern NOME = Pattern.compile("V(\\d+)__([a-z0-9_]+)\\.sql");

    /**
     * SHA-256 (com quebras de linha normalizadas) das migrações já publicadas. Ao publicar uma nova
     * versão, acrescente-a aqui no mesmo PR: a partir daí ela não pode mais mudar.
     */
    private static final Map<Integer, String> PUBLICADAS =
            Map.of(1, "5acdb27b9a419f8e3740251fa0656b3b9a848772e4fdb74e082f99dbe6a98afd");

    private static Map<Integer, Path> migracoes() throws IOException {
        Map<Integer, Path> porVersao = new TreeMap<>();
        try (Stream<Path> arquivos = Files.list(DIR)) {
            for (Path arquivo : arquivos.toList()) {
                String nome = arquivo.getFileName().toString();
                Matcher m = NOME.matcher(nome);
                assertTrue(m.matches(), "Nome fora do padrão V<n>__descricao_em_minusculas.sql: " + nome);
                Path anterior = porVersao.put(Integer.parseInt(m.group(1)), arquivo);
                assertEquals(null, anterior, "Versão repetida: " + nome);
            }
        }
        return porVersao;
    }

    @Test
    void versoesSaoSequenciaisAPartirDeUm() throws IOException {
        List<Integer> versoes = List.copyOf(migracoes().keySet());
        assertFalse(versoes.isEmpty(), "Nenhuma migração encontrada em " + DIR);
        for (int i = 0; i < versoes.size(); i++) {
            assertEquals(i + 1, versoes.get(i), "Buraco na sequência de migrações: " + versoes);
        }
    }

    @Test
    void migracoesPublicadasNaoMudam() throws Exception {
        Map<Integer, Path> migracoes = migracoes();
        for (Map.Entry<Integer, String> publicada : PUBLICADAS.entrySet()) {
            Path arquivo = migracoes.get(publicada.getKey());
            assertTrue(arquivo != null, "Migração publicada V" + publicada.getKey() + " foi removida");
            assertEquals(
                    publicada.getValue(),
                    sha256(arquivo),
                    arquivo.getFileName() + " já foi publicada e não pode ser editada; crie a próxima versão");
        }
    }

    @Test
    void todaMigracaoExistenteEstaRegistradaComoPublicadaOuEhNova() throws IOException {
        // Documenta o fluxo: a versão mais alta pode ser nova (ainda em revisão); as anteriores precisam estar fixas.
        Map<Integer, Path> migracoes = migracoes();
        int ultima = migracoes.keySet().stream().mapToInt(Integer::intValue).max().orElse(0);
        for (int versao : migracoes.keySet()) {
            if (versao < ultima) {
                assertTrue(
                        PUBLICADAS.containsKey(versao),
                        "V" + versao + " não é a mais recente; registre o hash em PUBLICADAS");
            }
        }
    }

    private static String sha256(Path arquivo) throws Exception {
        String texto = Files.readString(arquivo, StandardCharsets.UTF_8).replace("\r\n", "\n");
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }
}
