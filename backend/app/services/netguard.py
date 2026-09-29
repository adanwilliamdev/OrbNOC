"""Validação de hosts alvo (diagnóstico e monitor).

Sempre bloqueados: loopback, link-local (inclui 169.254.169.254), não especificado, multicast,
reservado e endereços de metadata de nuvem. Redes privadas ficam liberadas por padrão
(`ALLOW_PRIVATE_NETWORKS`), porque monitorar a LAN é o objetivo do produto.
"""

import asyncio
import ipaddress
import re
import socket

IPAddress = ipaddress.IPv4Address | ipaddress.IPv6Address

METADATA_ADDRESSES = {
    ipaddress.ip_address("169.254.169.254"),  # AWS, GCP, Azure, DigitalOcean...
    ipaddress.ip_address("fd00:ec2::254"),  # AWS IPv6
    ipaddress.ip_address("100.100.100.200"),  # Alibaba Cloud
    ipaddress.ip_address("192.0.0.192"),  # Oracle Cloud
}

_LABEL = r"[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?"
HOSTNAME_RE = re.compile(rf"^(?=.{{1,253}}$){_LABEL}(?:\.{_LABEL})*$")


class HostRejected(ValueError):
    """Host inválido ou proibido."""


def parse_host(value: str) -> str:
    """Valida a sintaxe (IP ou hostname) e devolve o valor normalizado. Não resolve DNS."""
    host = (value or "").strip().rstrip(".")
    if host.startswith("[") and host.endswith("]"):
        host = host[1:-1]
    if not host:
        raise HostRejected("Host é obrigatório")
    if host.startswith("-"):
        raise HostRejected("Host inválido")
    try:
        return str(ipaddress.ip_address(host))
    except ValueError:
        pass
    if not HOSTNAME_RE.match(host):
        raise HostRejected("Host inválido")
    return host.lower()


def _unwrap(ip: IPAddress) -> IPAddress:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return ip.ipv4_mapped
    return ip


def check_address(ip: IPAddress, allow_private: bool) -> None:
    ip = _unwrap(ip)
    if ip in METADATA_ADDRESSES:
        raise HostRejected("Endereço de metadata de nuvem bloqueado")
    if ip.is_loopback:
        raise HostRejected("Endereço de loopback bloqueado")
    if ip.is_link_local:
        raise HostRejected("Endereço link-local bloqueado")
    if ip.is_unspecified or ip.is_multicast or ip.is_reserved:
        raise HostRejected("Endereço reservado bloqueado")
    if not allow_private and not ip.is_global:
        raise HostRejected("Redes privadas estão desativadas neste servidor")


async def resolve_and_check(host: str, allow_private: bool, timeout: float = 5.0) -> list[str]:
    """Resolve o host e valida TODOS os endereços. Devolve os IPs (use-os para conectar)."""
    host = parse_host(host)
    try:
        addresses = [ipaddress.ip_address(host)]
    except ValueError:
        loop = asyncio.get_running_loop()
        try:
            infos = await asyncio.wait_for(
                loop.getaddrinfo(host, None, type=socket.SOCK_STREAM), timeout=timeout
            )
        except (TimeoutError, socket.gaierror) as exc:
            raise HostRejected("Não foi possível resolver o host") from exc
        addresses = []
        for info in infos:
            ip = ipaddress.ip_address(str(info[4][0]).split("%")[0])
            if ip not in addresses:
                addresses.append(ip)
    if not addresses:
        raise HostRejected("Não foi possível resolver o host")
    for ip in addresses:
        check_address(ip, allow_private)
    addresses.sort(key=lambda a: a.version)  # IPv4 primeiro
    return [str(_unwrap(a)) for a in addresses]
