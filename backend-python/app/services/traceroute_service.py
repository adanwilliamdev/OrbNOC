"""
Traceroute real via subprocess (sem shell=True, evita injeção de comando)
com parsing da saída do `traceroute` (Linux/macOS). Equivalente a rodar
a ferramenta de linha de comando e estruturar a saída em hops.
"""
import asyncio
import ipaddress
import re
import shutil

# Hostname simples (RFC 1123) ou IPv4/IPv6 — usado para rejeitar qualquer
# coisa que não seja um alvo de rede válido antes de montar o subprocess
# (defesa em profundidade: create_subprocess_exec já não passa por shell,
# mas isso evita, por exemplo, um host="--help" ser interpretado como flag).
_HOSTNAME_RE = re.compile(
    r"^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*"
    r"[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$"
)

_HOP_LINE_RE = re.compile(
    r"^\s*(\d+)\s+(.+)$"
)
_IP_RE = re.compile(r"\(?(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]+:[0-9a-fA-F:]+)\)?")
_TIME_RE = re.compile(r"([\d.]+)\s*ms")


class InvalidHostError(ValueError):
    pass


def validate_host(host: str) -> str:
    """Valida que `host` é um hostname ou IP válido. Levanta InvalidHostError caso contrário."""
    host = (host or "").strip()
    if not host:
        raise InvalidHostError("Host vazio")
    try:
        ipaddress.ip_address(host)
        return host
    except ValueError:
        pass
    if _HOSTNAME_RE.match(host):
        return host
    raise InvalidHostError(f"Host inválido: {host!r}")


def _parse_hop_line(line: str) -> dict | None:
    match = _HOP_LINE_RE.match(line)
    if not match:
        return None
    hop_number = int(match.group(1))
    rest = match.group(2)

    if "* * *" in rest or rest.strip() == "*":
        return {"hop": hop_number, "ip": None, "latency": None, "timeout": True}

    ip_match = _IP_RE.search(rest)
    ip = ip_match.group(1) if ip_match else None

    times = [float(t) for t in _TIME_RE.findall(rest)]
    avg_latency = round(sum(times) / len(times), 1) if times else None

    return {"hop": hop_number, "ip": ip, "latency": avg_latency, "timeout": False}


async def run_traceroute(host: str, max_hops: int = 20, timeout_sec: int = 30) -> dict:
    """
    Executa o traceroute real do sistema operacional. Faz fallback para
    `tracepath` se `traceroute` não estiver instalado, e retorna um erro
    estruturado (nunca dados fake) se nenhuma ferramenta estiver disponível.
    """
    validated_host = validate_host(host)

    binary = shutil.which("traceroute") or shutil.which("tracepath")
    if not binary:
        return {
            "target": validated_host,
            "hops": [],
            "available": False,
            "error": (
                "Nenhuma ferramenta de traceroute (traceroute/tracepath) "
                "encontrada no sistema. Instale iputils-tracepath ou "
                "traceroute na imagem do backend."
            ),
        }

    args = [binary]
    if "traceroute" in binary:
        args += ["-m", str(max_hops), "-w", "1", validated_host]
    else:  # tracepath não tem -m/-w equivalentes simples; usa defaults
        args += [validated_host]

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout_sec)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return {
            "target": validated_host,
            "hops": [],
            "available": True,
            "error": "Traceroute excedeu o tempo limite",
        }
    except FileNotFoundError:
        return {
            "target": validated_host,
            "hops": [],
            "available": False,
            "error": "Ferramenta de traceroute não encontrada",
        }

    output = stdout.decode(errors="ignore") if stdout else ""
    hops = []
    for line in output.splitlines():
        parsed = _parse_hop_line(line)
        if parsed:
            hops.append(parsed)

    return {"target": validated_host, "hops": hops, "available": True, "raw": output}
