"""
Resolução de DNS (A, AAAA, MX, TXT, CNAME) e reverse lookup (PTR).
Equivalente a src/services/dnsService.js.

Nota: a versão original em Node chamava `dns.lookup(ip)` para obter o
"reverse lookup", o que na verdade faz uma resolução direta (não reversa).
Aqui a busca reversa é implementada corretamente via registro PTR.
"""
from typing import Optional

import dns.asyncresolver
import dns.name
import dns.reversename


async def resolve_domain(domain: str, record_type: str = "A") -> list[dict]:
    record_type = (record_type or "A").upper()
    answer = await dns.asyncresolver.resolve(domain, record_type)

    if record_type in ("A", "AAAA"):
        return [{"value": r.address} for r in answer]
    if record_type == "MX":
        return [
            {"value": f"{r.exchange.to_text().rstrip('.')} (priority {r.preference})"}
            for r in answer
        ]
    if record_type == "TXT":
        return [
            {"value": b" ".join(r.strings).decode("utf-8", errors="ignore")}
            for r in answer
        ]
    if record_type == "CNAME":
        return [{"value": r.target.to_text().rstrip(".")} for r in answer]

    return [{"value": r.to_text()} for r in answer]


async def reverse_lookup(ip: str) -> Optional[str]:
    """Busca o hostname associado a um IP através de um registro PTR."""
    rev_name = dns.reversename.from_address(ip)
    answer = await dns.asyncresolver.resolve(rev_name, "PTR")
    if not answer:
        return None
    return answer[0].to_text().rstrip(".")
