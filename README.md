# Encarte Builder

Editor visual de encartes/folhetos de ofertas para varejo, com a **mesma mecânica do qrofertas.com**: você digita o nome do produto, o sistema busca a foto automaticamente, e você arrasta no canvas estilo Canva.

## Mecânica replicada do qrofertas

| Funcionalidade qrofertas | Como foi replicada aqui |
|---|---|
| Digita produto → backend busca imagem | `/api/produtos/buscar` consulta cache local + **Open Food Facts** (>2M produtos brasileiros) |
| Banco próprio de imagens | `backend/data/produtos.json` cresce automaticamente; imagens cacheadas em `backend/uploads/produtos/` |
| Templates capa + miolo + contracapa | Templates JSON com array `paginas[]` |
| Drag/drop estilo Canva | Fabric.js (mais robusto que jQuery UI do original) |
| Snap-to-grid | 8px ao mover objetos |
| Multi-página | Capa, miolo, contracapa com tabs |
| Exportação PDF e PNG | jsPDF (PDF multipáginas) + canvas.toDataURL (PNG 2x) |

## Stack

- **Frontend:** React 18 + Vite + Fabric.js + jsPDF
- **Backend:** Node.js + Express + Multer + busca em Open Food Facts

## Como rodar

### 1. Backend (porta 4010)

```bash
cd backend
npm install
npm start   # ou npm run dev (com hot reload)
```

Na primeira execução, o backend popula automaticamente o banco com **17 produtos brasileiros populares** (Coca-Cola, Leite Ninho, Café Pilão, Arroz Tio João etc.) e baixa as imagens correspondentes para cache local.

### 2. Frontend (porta 5173, 5174 ou 5175)

```bash
cd frontend
npm install
npm run dev
```

Abra a URL exibida (ex: http://localhost:5175). O proxy do Vite redireciona `/api/*` e `/uploads/*` para o backend em `:4010`.

## Estrutura

```
Encarte Builder/
├── backend/
│   ├── src/
│   │   ├── server.js              # API Express
│   │   ├── produtos-db.js         # CRUD do banco JSON
│   │   ├── busca-imagens.js       # Integração Open Food Facts + cache
│   │   └── seed-produtos.js       # 17 produtos brasileiros iniciais
│   ├── data/produtos.json         # Banco de produtos (cresce com uso)
│   ├── templates/                 # Templates JSON (single ou multipágina)
│   ├── projetos/                  # Encartes salvos pelo usuário
│   └── uploads/                   # Imagens enviadas + produtos/ (cache OFF)
└── frontend/
    ├── src/
    │   ├── App.jsx                # Layout + multi-página + export
    │   ├── editor/editor.js       # Motor Fabric.js (canvas, formas, cards de produto)
    │   ├── components/            # Painéis: Templates, Produtos, Elementos, Propriedades
    │   └── styles/app.css
    └── vite.config.js
```

## Endpoints da API

| Método | URL | Descrição |
|---|---|---|
| GET | `/api/health` | Healthcheck |
| GET | `/api/produtos/buscar?q=arroz` | Busca produto (cache local + OFF) |
| GET | `/api/produtos` | Lista todos do banco local |
| GET | `/api/produtos/:id` | Detalhe de produto |
| POST | `/api/produtos` | Cria/atualiza produto (cacheia imagem se for URL externa) |
| PUT | `/api/produtos/:id` | Atualiza |
| DELETE | `/api/produtos/:id` | Remove |
| GET | `/api/proxy-imagem?url=...` | Baixa imagem externa para servir local (evita CORS) |
| GET | `/api/templates` | Lista templates |
| GET | `/api/templates/:id` | Carrega template |
| GET | `/api/projetos` | Lista projetos salvos |
| POST | `/api/projetos` | Salva projeto |
| GET | `/api/projetos/:id` | Carrega projeto |
| DELETE | `/api/projetos/:id` | Remove |
| POST | `/api/upload` | Upload genérico de imagem |

## Fluxo do usuário

1. Abre o app → vê templates na barra lateral
2. Clica em **"Supermercado Completo (3 páginas)"** → carrega capa, miolo, contracapa
3. Vai na aba **Produtos** e digita "leite" → 13 resultados aparecem com fotos
4. Clica num produto → digita preço → produto entra no canvas com a foto
5. Arrasta, redimensiona, edita texto/cor (estilo Canva)
6. Adiciona texto, formas, faz upload de logo
7. Clica em **Exportar PDF** → baixa o encarte completo

## Funcionalidades

- ✅ Editor Canvas multi-página (A4/A3/Tabloide)
- ✅ **Busca de produtos com imagens automáticas** (Open Food Facts + cache local)
- ✅ Banco de produtos crescente, com seed inicial de 17 produtos brasileiros
- ✅ Cadastro manual de produtos (com URL ou descrição)
- ✅ Templates multi-página (capa + miolo + contracapa)
- ✅ Drag & drop, snap-to-grid 8px, zoom 20–200%
- ✅ Texto, formas (retângulo/círculo), upload de imagem
- ✅ Painel de propriedades (cor, fonte, opacidade, rotação, etc.)
- ✅ Atalhos: `Delete` remove, `Ctrl+D` duplica
- ✅ Salvar/carregar projetos
- ✅ Exportação PDF (multipáginas) e PNG (alta resolução 2x)

## Observação sobre Open Food Facts

A API pública `world.openfoodfacts.org` ocasionalmente fica indisponível (manutenção). Quando isso acontece:
- Busca local continua funcionando normalmente (17 produtos seed + tudo que você cadastrou)
- Frontend mostra aviso `⚠️ API Open Food Facts indisponível`
- Cadastro manual sempre disponível

## Próximo passo: agente de IA

Plug-in planejado: agente que ouve mensagens (WhatsApp, planilha, etc.) e cria/atualiza produtos automaticamente via `POST /api/produtos`. Como o endpoint já cacheia imagens externas no upload, basta fornecer `{ nome, marca, preco, imagem }` e o produto fica disponível no painel de busca para arrastar no encarte.
