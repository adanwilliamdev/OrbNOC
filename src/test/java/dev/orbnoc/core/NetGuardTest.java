package dev.orbnoc.core;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
}
