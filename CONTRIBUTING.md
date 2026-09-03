# Contribuindo para o OrbNOC

Obrigado por considerar contribuir! Este guia cobre o essencial para configurar o
ambiente, rodar os testes e abrir um PR com boas chances de ser aceito rápido.

## Setup do ambiente

### Backend (Python)

```bash
cd backend-python
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # ajuste DATABASE_URL, JWT_SECRET etc.
```

### Frontend (Next.js)

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local   # se existir; caso contrário, defina NEXT_PUBLIC_API_URL
```

Veja a seção "Rodando Localmente" do [README](./README.md) para o passo a passo completo,
incluindo a opção via Docker Compose.

## Rodando os testes

```bash
cd backend-python
pytest -v          # testes unitários e de integração leve
ruff check .        # lint — corrija tudo que o ruff apontar antes de abrir o PR
```

```bash
cd frontend
npm run lint
npm run build       # garante que o projeto builda antes do PR
```

Todo PR passa automaticamente pelo workflow de CI (`.github/workflows/ci.yml`), que roda
exatamente esses comandos. Rode-os localmente antes de abrir o PR para economizar
tempo de revisão.

## Padrão de commits

Não exigimos um formato rígido, mas commits pequenos e descritivos (o que mudou e por quê)
facilitam muito o review. Prefira vários commits pequenos a um único commit gigante.

## Abrindo um Pull Request

1. Faça um fork do repositório e crie uma branch a partir de `main`:
   `git checkout -b minha-feature`
2. Implemente a mudança, com testes cobrindo o comportamento novo/alterado sempre que
   fizer sentido (rotas, services e regras de negócio devem ter teste).
3. Rode lint + testes localmente (seção acima).
4. Abra o PR descrevendo: o que mudou, por quê, e como testar manualmente se aplicável.
5. Vincule a issue relacionada, se houver.

## Reportando bugs e sugerindo features

Abra uma issue descrevendo:
- **Bug**: passos para reproduzir, comportamento esperado vs. observado, versão/ambiente.
- **Feature**: o problema que ela resolve e, se possível, uma proposta de solução.

## Segurança

Se encontrar uma vulnerabilidade, evite abrir uma issue pública — entre em contato
diretamente com os mantenedores do repositório para um disclosure responsável.
