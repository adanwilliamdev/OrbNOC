"""
Converte um padrão com wildcard (ex: "http://localhost:*") em uma verificação
de origem, equivalente à função `origemPermitida` usada no main.ts original.
"""
from __future__ import annotations

import re
from typing import Iterable, List


def compile_patterns(patterns: Iterable[str]) -> List[re.Pattern]:
    compiled = []
    for padrao in patterns:
        escaped = re.escape(padrao).replace(r"\*", ".*")
        compiled.append(re.compile(f"^{escaped}$"))
    return compiled


def origem_permitida(compiled_patterns: List[re.Pattern], origin: str) -> bool:
    return any(p.match(origin) for p in compiled_patterns)
