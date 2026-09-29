"""Validação de alvos de rede (monitoramento e diagnóstico).

Evita que a plataforma seja usada para atacar o próprio servidor ou a infraestrutura de nuvem
(SSRF): bloqueia loopback (configurável), link-local (inclui o metadata 169.254.169.254),
endereços não especificados, multicast e reservados. Redes privadas ficam liberadas por padrão,
porque monitorar a LAN é o objetivo do produto (ALLOW_PRIVATE_TARGETS=false para restringir).

A sintaxe do host é validada rigorosamente e o alvo passado a processos externos é sempre um
IP já validado, nunca texto do usuário.
"""

import asyncio
import ipaddress
import re
import socket
from dataclasses import dataclass

from app.core.config import get_settings

_LABEL = r"[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?"
_HOSTNAME_RE = re.compile(rf"^{_LABEL}(?:\.{_LABEL})*$")
_ALWAYS_BLOCKED = (
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local + metadata de nuvem
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("fd00:ec2::254/128"),  # metadata AWS via IPv6
)

IPAddress = ipaddress.IPv4Address | ipaddress.IPv6Address


class TargetError(ValueError):
    """Alvo inválido ou não permitido."""


@dataclass(frozen=True)
class ResolvedTarget:
    host: str  # como informado (IP ou hostname normalizado)
    addresses: list[str]  # IPs já validados; usar SEMPRE estes para conectar

    @property
    def address(self) -> str:
        return self.addresses[0]


def parse_host(raw: str) -> str:
    """Valida a sintaxe e devolve o host normalizado (IP em forma canônica ou hostname minúsculo)."""
    value = (raw or "").strip()
    if value.startswith("[") and value.endswith("]"):
        value = value[1:-1]
    if not value:
        raise TargetError("Host não informado")
    if len(value) > 253:
        raise TargetError("Host muito longo")
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        pass
    value = value.rstrip(".").lower()
    if not _HOSTNAME_RE.match(value):
        raise TargetError(
            "Host inválido: use um IP ou um nome de host (sem espaços, barras ou caracteres especiais)"
        )
    if value.rsplit(".", 1)[-1].isdigit():
        raise TargetError("Host inválido: formatos numéricos abreviados não são aceitos")
    return value


def check_ip(ip: IPAddress) -> None:
    """Levanta TargetError se o IP não puder ser alvo."""
    settings = get_settings()
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    if ip.is_loopback:  # antes de "reservado": ::1 também cai em uma faixa reservada do IPv6
        if not settings.allow_loopback_targets:
            raise TargetError("Endereços de loopback não são permitidos")
        return
    if ip.is_unspecified or ip.is_multicast or ip.is_reserved:
        raise TargetError(f"Endereço {ip} não é um alvo válido")
    if any(ip in net for net in _ALWAYS_BLOCKED):
        raise TargetError(f"Endereço {ip} é bloqueado (link-local / metadata de nuvem)")
    if ip.is_private and not settings.allow_private_targets:
        raise TargetError("Redes privadas não são permitidas neste ambiente")


async def resolve_target(raw: str) -> ResolvedTarget:
    """Valida o host, resolve o DNS e confere TODOS os IPs resultantes."""
    host = parse_host(raw)
    try:
        addresses = [str(ipaddress.ip_address(host))]
    except ValueError:
        loop = asyncio.get_running_loop()
        try:
            infos = await loop.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise TargetError(f"Não foi possível resolver o host '{host}'") from exc
        seen: dict[str, None] = {}
        for _family, _type, _proto, _canon, sockaddr in infos:
            seen.setdefault(str(sockaddr[0]), None)
        addresses = sorted(seen, key=lambda a: (":" in a, a))  # IPv4 primeiro
        if not addresses:
            raise TargetError(f"Não foi possível resolver o host '{host}'") from None
    for address in addresses:
        check_ip(ipaddress.ip_address(address))
    return ResolvedTarget(host=host, addresses=addresses)


async def validate_for_registration(raw: str) -> str:
    """Usado ao cadastrar um dispositivo: um hostname que ainda não resolve é aceito
    (o equipamento pode estar fora do ar), mas um que resolve para um IP proibido não."""
    host = parse_host(raw)
    try:
        await resolve_target(host)
    except TargetError as exc:
        if "resolver" in str(exc):
            return host
        raise
    return host
