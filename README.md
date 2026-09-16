# CineCuts

SaaS de assinatura de vídeo (estilo Netflix) para um catálogo de **filmes em
domínio público / com licença livre de distribuição**, com um pipeline
automatizado para gerar clipes curtos e publicá-los no Instagram como
divulgação ("assista o filme completo — link na bio") para vender assinaturas.

> ⚠️ **Sobre o conteúdo do catálogo**: cada filme guarda um campo
> `publicDomainNotes` (obrigatório) documentando a fonte/jurisdição que
> comprova que ele pode ser distribuído livremente. Status de domínio público
> varia por país e **não existe lista oficial** — valide título a título antes
> de publicar. Um filme estar hospedado no Internet Archive é um bom indício,
> não uma garantia jurídica.

## Rodando em 5 minutos (modo demo, sem cartão nem Meta)

```bash
cp .env.example .env            # os padrões já funcionam para desenvolvimento
docker compose up -d            # Postgres + Redis

npm install
npm run db:migrate              # cria as tabelas
npm run db:seed                 # cria o admin (ADMIN_EMAIL/ADMIN_PASSWORD do .env)
npm run seed:demo               # popula 12 clássicos com vídeos de amostra

npm run dev:web                 # http://localhost:3000
npm run dev:worker              # em outro terminal: filas de clipe e postagem
```

Depois: crie uma conta em `/registrar`, clique em **"Ativar assinatura de teste"**
(modo demo, não cobra nada) e o catálogo libera. O painel fica em `/admin` com
o login do seed.

Requisitos: Node 20+, `ffmpeg` no PATH (o worker usa para cortar os clipes),
Postgres e Redis (via docker compose ou instâncias próprias).

### O que é real e o que é casca

| Recurso | Sem configurar | Depois de configurar |
| --- | --- | --- |
| Cadastro, login, paywall | real | real |
| Catálogo, player, streaming com seek | real | real |
| Geração de clipes (ffmpeg) | real | real |
| Pagamento | botão "Assinar com cartão" responde "não configurado"; o botão de demo libera 30 dias | Stripe Checkout + webhook de verdade |
| Postagem no Instagram | simulada (loga a legenda e marca como POSTED) | publicação real via Graph API |
| Storage | disco local em `./storage`, servido por `/api/media` | bucket S3/R2 com URL pré-assinada |

Para sair do modo demo: preencha as chaves no `.env` e defina `DEMO_MODE=false`
(isso remove o botão de assinatura de teste). O código das integrações reais já
está no lugar — só passa a ser usado quando as credenciais existem.

## Trazendo os filmes reais (Internet Archive)

O seed de demonstração usa metadados reais mas **vídeos gerados localmente**.
Para importar filmes de verdade:

```bash
npm run import:archive -- --limit 60
# opções: --collection silent_films (padrão) | --limit N | --publish | --allow-unverified
```

O script busca na API do archive.org ordenando por downloads, resolve cada item
pela API de metadados (melhor derivativo mp4, duração e thumbnail) e grava os
filmes apontando direto para a URL no Internet Archive — sem ocupar storage seu.
`publicDomainNotes` registra o item, as coleções e a base dos direitos.

**Escolha da coleção importa.** O padrão é `silent_films` (curada, quase toda
anterior a 1930, com licença declarada). Evite `feature_films`: são 28 mil itens
de upload aberto, com cópias claramente piratas de filmes protegidos no meio.

Dois filtros rodam por padrão e podem ser desligados/ajustados:

- **Direitos**: só entra item com licença declarada ou publicado antes do corte
  de 96 anos. `--allow-unverified` desliga (não recomendado).
- **Conteúdo adulto**: descarta títulos/descrições com marcadores óbvios. É uma
  barreira grosseira — a thumbnail do Archive é um frame arbitrário do filme, e
  o acervo mudo inclui material erótico e exploitation.

Por isso o import entra como `DRAFT` a menos que você passe `--publish`:
**revise em `/admin` antes de publicar**. Numa importação real de 40 títulos da
`silent_films` foi preciso arquivar manualmente três: *The Birth of a Nation*
(propaganda da KKK), *The Roman Orgy* e um curta de 1906 sem descrição com nudez
na thumbnail.

Para exportar o catálogo publicado como JSON (backup ou protótipo):

```bash
npx tsx apps/worker/src/scripts/exportCatalog.ts catalogo.json
```

## Arquitetura

```
apps/
  web/      Next.js 14 (App Router) — landing, auth, assinatura, catálogo,
            player, painel admin e a rota /api/media
  worker/   Node.js — geração de clipes (ffmpeg) e publicação agendada no
            Instagram, consumindo filas BullMQ/Redis
packages/
  db/       Schema Prisma (Postgres)
  storage/  Driver de storage (local ou S3-compatible)
```

Fluxo do produto:

1. Admin importa filmes do Internet Archive (ou sobe o arquivo pelo `/admin`).
2. Admin recorta um trecho (início/fim em segundos) e cria um `Clip`.
3. O worker consome a fila `clip-generation` e corta o trecho com `ffmpeg`
   (lendo direto da URL externa quando o filme não está no storage local).
4. Admin revisa o clipe no player do painel e agenda a publicação.
5. O scheduler verifica a cada minuto os posts vencidos e enfileira em
   `social-posting`.
6. O worker publica como Reels via Graph API, com a legenda e o CTA do link na bio.
7. O visitante assina, e só assinatura ativa libera catálogo e player.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev:web` / `npm run dev:worker` | sobe app e worker em modo dev |
| `npm run db:migrate` / `db:deploy` | migrações (dev / produção) |
| `npm run db:seed` | cria/promove o usuário admin |
| `npm run seed:demo` | catálogo de demonstração gerado com ffmpeg |
| `npm run import:archive` | importa filmes reais do Internet Archive |
| `npm run db:studio` | Prisma Studio |
| `npm run build` | build de produção de tudo |

## Segurança / decisões relevantes

- O filme completo só é servido para sessão com assinatura ativa: no storage
  local a rota `/api/media` checa a assinatura a cada request; no S3 a URL é
  pré-assinada e expira em 10 minutos.
- Pôsteres e clipes são públicos de propósito (landing page e download do
  vídeo pelo Instagram); o filme completo nunca é.
- Chaves de storage passam por `sanitizeStorageKey`, que rejeita `..`, caminhos
  absolutos e caracteres fora de `[A-Za-z0-9._-]` — sem isso o driver local
  permitiria leitura/escrita fora do diretório de mídia.
- `/api/media` implementa Range/206, então o player faz seek sem baixar o
  arquivo inteiro.
- Senhas com bcrypt; sessão JWT (NextAuth Credentials); webhook do Stripe
  valida assinatura antes de processar.
- A API de otimização de imagem do Next (`/_next/image`) está desativada — não
  usamos `next/image` e ela concentra CVEs conhecidas na série 14.x.

## Limitações conhecidas

- O worker roda o scheduler por polling (1 min). Para volume alto, trocar por
  jobs atrasados do próprio BullMQ.
- Não há testes automatizados ainda.
- Sem rate limiting em `/api/auth/register` e login.
- O `postcss` embutido no Next 14 tem advisories abertos (só afeta build-time);
  some ao migrar para Next 16.
