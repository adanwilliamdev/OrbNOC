package dev.orbnoc.core;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class NetGuardTest {

    @ParameterizedTest
    @ValueSource(strings = {"8.8.8.8", "example.com", "my-host_1.lan", "[2001:db8::1]"})
    void aceitaHostsValidos(String value) {
        assertDoesNotThrow(() -> NetGuard.parseHost(value));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "  ", "-oProxyCommand=x", "a b", "host;rm -rf /", "$(id).com", "a..b",
            "http://evil.com", "host\nname"})
    void rejeitaHostsInvalidos(String value) {
        assertThrows(HostRejectedException.class, () -> NetGuard.parseHost(value));
    }

    @Test
    void rejeitaHostLongoDemais() {
        assertThrows(HostRejectedException.class, () -> NetGuard.parseHost("x".repeat(300)));
    }

    @Test
    void normalizaHosts() {
        assertEquals("example.com", NetGuard.parseHost("  ExAmple.COM. "));
        assertEquals("::1", NetGuard.parseHost("[::1]"));
        assertEquals("2001:db8::1", NetGuard.parseHost("2001:0db8:0000:0000:0000:0000:0000:0001"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"127.0.0.1", "127.5.5.5", "::1", "169.254.169.254", "169.254.1.1", "fe80::1", "0.0.0.0",
            "224.0.0.1", "fd00:ec2::254", "100.100.100.200", "::ffff:127.0.0.1", "::ffff:169.254.169.254"})
    void semprebloqueados(String addr) {
        for (boolean allowPrivate : new boolean[] {true, false}) {
            assertThrows(HostRejectedException.class,
                    () -> NetGuard.checkAddress(NetGuard.parseIpLiteral(addr), allowPrivate));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"10.0.0.5", "192.168.1.1", "172.16.4.4", "100.64.0.9"})
    void privadosSoQuandoLiberados(String addr) {
        assertDoesNotThrow(() -> NetGuard.checkAddress(NetGuard.parseIpLiteral(addr), true));
        assertThrows(HostRejectedException.class, () -> NetGuard.checkAddress(NetGuard.parseIpLiteral(addr), false));
    }

    @Test
    void publicoSempreLiberado() {
        assertDoesNotThrow(() -> NetGuard.checkAddress(NetGuard.parseIpLiteral("8.8.8.8"), false));
    }

    @Test
    void resolveLiteralIp() {
        assertEquals(List.of("10.1.2.3"), NetGuard.resolveAndCheck("10.1.2.3", true, 2000));
        assertThrows(HostRejectedException.class, () -> NetGuard.resolveAndCheck("127.0.0.1", true, 2000));
    }

    @Test
    void localhostBloqueado() {
        assertThrows(HostRejectedException.class, () -> NetGuard.resolveAndCheck("localhost", true, 2000));
    }

    @ParameterizedTest
    @ValueSource(strings = {"64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "2002:7f00:1::", "2002:a9fe:a9fe::1",
            "2001:0:4136:e378:8000:63bf:3fff:fdd2", "64:ff9b:1::1"})
    void tradutoresETunelsNaoContornamOBloqueio(String addr) {
        for (boolean allowPrivate : new boolean[] {true, false}) {
            assertThrows(HostRejectedException.class,
                    () -> NetGuard.checkAddress(NetGuard.parseIpLiteral(addr), allowPrivate));
        }
    }

    @Test
    void nat64ESeisParaQuatroSeguemAsRegrasDoIpv4Embutido() {
        assertDoesNotThrow(() -> NetGuard.checkAddress(NetGuard.parseIpLiteral("64:ff9b::808:808"), false));
        assertDoesNotThrow(() -> NetGuard.checkAddress(NetGuard.parseIpLiteral("64:ff9b::a00:1"), true));
        assertThrows(HostRejectedException.class,
                () -> NetGuard.checkAddress(NetGuard.parseIpLiteral("64:ff9b::a00:1"), false));
        assertDoesNotThrow(() -> NetGuard.checkAddress(NetGuard.parseIpLiteral("fec0::1"), true));
        assertThrows(HostRejectedException.class,
                () -> NetGuard.checkAddress(NetGuard.parseIpLiteral("fec0::1"), false));
    }

    /** Propriedade: embrulhar qualquer IPv4 em NAT64 ou 6to4 não muda o veredito do IPv4 puro. */
    @Test
    void propriedadeVeredictoIgualAoDoIpv4Embutido() {
        java.util.Random random = new java.util.Random(42);
        for (int i = 0; i < 5_000; i++) {
            int[] b = {random.nextInt(256), random.nextInt(256), random.nextInt(256), random.nextInt(256)};
            String v4 = b[0] + "." + b[1] + "." + b[2] + "." + b[3];
            String nat64 = String.format("64:ff9b::%02x%02x:%02x%02x", b[0], b[1], b[2], b[3]);
            String sixToFour = String.format("2002:%02x%02x:%02x%02x::1", b[0], b[1], b[2], b[3]);
            for (boolean allowPrivate : new boolean[] {true, false}) {
                boolean esperado = bloqueado(v4, allowPrivate, CidrList.EMPTY);
                assertEquals(esperado, bloqueado(nat64, allowPrivate, CidrList.EMPTY), nat64);
                assertEquals(esperado, bloqueado(sixToFour, allowPrivate, CidrList.EMPTY), sixToFour);
            }
        }
    }

    @Test
    void allowlistRestringeSoRedesPrivadas() {
        CidrList lista = CidrList.parse("10.1.0.0/16, 192.168.5.7, fd00::/8");
        assertFalse(bloqueado("10.1.2.3", true, lista));
        assertTrue(bloqueado("10.2.0.1", true, lista));
        assertFalse(bloqueado("192.168.5.7", true, lista));
        assertTrue(bloqueado("192.168.5.8", true, lista));
        assertFalse(bloqueado("8.8.8.8", true, lista), "endereços públicos não dependem da lista");
        assertTrue(bloqueado("64:ff9b::a02:1", true, lista), "o IPv4 embutido também passa pela lista");
        assertFalse(bloqueado("64:ff9b::a01:101", true, lista));
        assertThrows(IllegalArgumentException.class, () -> CidrList.parse("10.0.0.0/40"));
        assertThrows(IllegalArgumentException.class, () -> CidrList.parse("não-é-ip"));
        assertTrue(CidrList.parse(" ").isEmpty());
    }

    private static boolean bloqueado(String addr, boolean allowPrivate, CidrList lista) {
        try {
            NetGuard.checkAddress(NetGuard.parseIpLiteral(addr), allowPrivate, lista);
            return false;
        } catch (HostRejectedException e) {
            return true;
        }
    }
}
