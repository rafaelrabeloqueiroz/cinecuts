# CineCuts

SaaS de assinatura de vídeo (estilo Netflix) para um catálogo de **filmes em
domínio público / com licença livre de distribuição**, com um pipeline
automatizado para gerar clipes curtos e publicá-los no Instagram como
divulgação ("assista o filme completo — link na bio") para vender assinaturas.

> ⚠️ **Sobre o conteúdo do catálogo**: cada filme cadastrado guarda um campo
> `publicDomainNotes` (obrigatório) documentando a fonte/jurisdição que
> comprova que ele pode ser distribuído livremente. Status de domínio público
> varia por país — valide caso a caso antes de publicar. A plataforma não
> foi desenhada para hospedar ou redistribuir conteúdo protegido por
> direitos autorais sem licença.

## Arquitetura

Monorepo com npm workspaces:

```
apps/
  web/      Next.js 14 (App Router) — site, autenticação, assinatura (Stripe),
            catálogo, player, painel admin
  worker/   Node.js — geração de clipes (ffmpeg) e publicação agendada no
            Instagram (Graph API), consumindo filas BullMQ/Redis
packages/
  db/       Schema Prisma (Postgres) compartilhado entre web e worker
```

Fluxo:

1. Admin sobe um filme (arquivo de vídeo + pôster) via upload assinado
   direto para o storage S3-compatible (R2/S3).
2. Admin recorta um trecho (início/fim em segundos) e cria um `Clip`.
3. O worker consome a fila `clip-generation`, baixa o filme, corta o trecho
   com `ffmpeg`, sobe o resultado e marca o clipe como `READY`.
4. Admin agenda uma publicação (`SocialPost`) daquele clipe para um horário.
5. O scheduler do worker verifica a cada minuto os posts `SCHEDULED` vencidos
   e enfileira a publicação na fila `social-posting`.
6. O worker publica o clipe como Reels via Instagram Graph API, com legenda
   contendo a chamada para assinar ("link na bio").
7. Usuários assinam via Stripe Checkout; o webhook do Stripe mantém o status
   da assinatura sincronizado; só assinantes com assinatura ativa acessam o
   catálogo e o player (via URL assinada e temporária, não pública).

## Requisitos

- Node.js 20+
- Docker (para Postgres + Redis locais) ou instâncias próprias
- `ffmpeg` disponível no ambiente onde o **worker** roda (imagem Docker de
  produção deve instalar o pacote `ffmpeg`)
- Conta Stripe (modo teste para desenvolvimento)
- Bucket S3-compatible (AWS S3, Cloudflare R2, etc.) com domínio público
  (CDN) para servir os vídeos/clipes
- Conta Instagram Profissional (Business/Creator) vinculada a uma Página do
  Facebook, um App no Meta for Developers com permissão
  `instagram_content_publish`, e um token de acesso de longa duração

## Setup local

```bash
cp .env.example .env       # preencha as credenciais (Stripe, storage, Meta)
docker compose up -d       # sobe Postgres + Redis

npm install
npm run db:generate
npm run db:migrate         # cria as tabelas

# cria o primeiro usuário admin (defina ADMIN_EMAIL/ADMIN_PASSWORD no .env)
npm run --workspace packages/db seed

npm run dev:web            # http://localhost:3000
npm run dev:worker         # processa filas de clipe/postagem
```

As variáveis de ambiente estão documentadas em `.env.example`. `web` e
`worker` leem o mesmo `.env`/`.env.local` na raiz de cada app — copie os
valores relevantes para `apps/web/.env.local` e `apps/worker/.env` em
desenvolvimento, ou injete-os via seu orquestrador em produção.

## Painel admin

- `/admin` — lista de filmes
- `/admin/filmes/novo` — cadastro de filme (upload de vídeo + pôster)
- `/admin/filmes/[id]` — gera clipes (ffmpeg), acompanha status, agenda ou
  publica imediatamente no Instagram

Apenas usuários com `role = ADMIN` acessam essas rotas e APIs
(`/api/admin/*`).

## Segurança / decisões relevantes

- O vídeo do filme completo é servido via **URL assinada de curta duração**
  (não uma URL pública fixa), gerada só depois de confirmar sessão +
  assinatura ativa — evita vazamento de link reutilizável.
- A API de otimização de imagem do Next (`/_next/image`) está desativada em
  `next.config.mjs` (não usamos `next/image`), reduzindo superfície de
  ataque de CVEs conhecidas do framework.
- Senhas são hasheadas com bcrypt; sessão via JWT (NextAuth Credentials).
- Webhooks do Stripe validam assinatura (`STRIPE_WEBHOOK_SECRET`) antes de
  processar qualquer evento.

## Próximos passos sugeridos

- Testes automatizados (unitários para lib/ e e2e para o fluxo de assinatura)
- Observabilidade (logs estruturados, alertas de falha nas filas)
- Rate limiting nas rotas públicas (registro/login)
- Painel de métricas (assinantes ativos, MRR, clipes publicados, CTR do
  link na bio)
