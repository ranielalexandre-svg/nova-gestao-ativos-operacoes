# Deploy no servidor 192.168.58.159

Este guia prepara a substituicao gradual do site legado pelo NOVA. A ideia e primeiro subir o novo stack em paralelo, validar login/dados/healthcheck e so depois trocar o proxy do site legado.

## Arquitetura recomendada

- PostgreSQL local ou acessivel pela API.
- API Nest em `127.0.0.1:4000`.
- Web Next em `127.0.0.1:3010`.
- Nginx/Apache publico em `192.168.58.159:80` encaminhando o site para o Next.
- A API nao precisa ficar publica; o Next chama a API por `API_BASE_URL_INTERNAL`.

## Antes de mexer no legado

1. Identifique como o legado esta rodando:
   ```bash
   sudo ss -ltnp
   sudo systemctl list-units --type=service --state=running
   sudo nginx -T 2>/dev/null | less
   sudo apachectl -S 2>/dev/null
   ```
2. Faca backup dos arquivos de configuracao atuais:
   ```bash
   sudo mkdir -p /opt/backups/nova-legado-$(date +%Y%m%d-%H%M)
   sudo cp -a /etc/nginx /opt/backups/nova-legado-$(date +%Y%m%d-%H%M)/nginx 2>/dev/null || true
   sudo cp -a /etc/apache2 /opt/backups/nova-legado-$(date +%Y%m%d-%H%M)/apache2 2>/dev/null || true
   ```
3. Combine uma janela de troca. Nao pare o legado antes do NOVA responder localmente.

## Preparar o servidor

```bash
sudo apt update
sudo apt install -y git curl postgresql nginx

# Node 20+ e Corepack precisam estar disponiveis.
node -v
corepack --version
corepack enable
```

Se o Node instalado for antigo, instale Node 20+ antes de seguir.

## Clonar e instalar

```bash
sudo mkdir -p /opt/nova
sudo chown "$USER":"$USER" /opt/nova
cd /opt/nova
git clone git@github.com:ranielalexandre-svg/nova-gestao-ativos-operacoes.git app
cd app
corepack pnpm install --frozen-lockfile
```

## Configurar variaveis

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Edite `apps/api/.env`:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://nova_user:SENHA_FORTE@127.0.0.1:5432/nova_gestao?schema=public
JWT_SECRET=gere-com-openssl-rand-base64-48
INTEGRATION_SECRET_KEY=gere-outro-segredo-com-openssl-rand-base64-48
CORS_ORIGINS=http://192.168.58.159
ADMIN_EMAIL=admin@nova.local
ADMIN_PASSWORD=senha-temporaria-forte
NOVA_UPLOAD_DIR=/opt/nova/uploads
```

Edite `apps/web/.env.local`:

```env
NODE_ENV=production
PORT=3010
API_BASE_URL_INTERNAL=http://127.0.0.1:4000
WEB_SESSION_COOKIE_SECURE=false
```

Use `WEB_SESSION_COOKIE_SECURE=true` se o acesso final for HTTPS.

## Banco e build

```bash
createdb nova_gestao 2>/dev/null || true
sudo mkdir -p /opt/nova/uploads
sudo chown "$USER":"$USER" /opt/nova/uploads
corepack pnpm --dir apps/api prisma:migrate:deploy
corepack pnpm --dir apps/api seed
corepack pnpm check:deploy
```

O `seed` cria/atualiza o usuario administrador configurado em `apps/api/.env`.

## Systemd

Crie `/etc/systemd/system/nova-api.service`:

```ini
[Unit]
Description=NOVA API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/nova/app
EnvironmentFile=/opt/nova/app/apps/api/.env
ExecStart=/usr/bin/corepack pnpm --dir apps/api start:prod
Restart=always
RestartSec=5
User=raniel

[Install]
WantedBy=multi-user.target
```

Crie `/etc/systemd/system/nova-web.service`:

```ini
[Unit]
Description=NOVA Web
After=network.target nova-api.service

[Service]
Type=simple
WorkingDirectory=/opt/nova/app
EnvironmentFile=/opt/nova/app/apps/web/.env.local
ExecStart=/usr/bin/corepack pnpm --dir apps/web start
Restart=always
RestartSec=5
User=raniel

[Install]
WantedBy=multi-user.target
```

Ajuste `User=raniel` se o usuario do servidor for outro.

Ative:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nova-api nova-web
sudo systemctl status nova-api nova-web --no-pager
```

Valide localmente no servidor:

```bash
curl -fsS http://127.0.0.1:4000/health
curl -fsS http://127.0.0.1:4000/health/ready
curl -fsS http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:3010/login
```

O `/health/ready` retorna um bloco `checks` com banco, pasta de anexos e
segredos essenciais. Para a troca final, `summary.failed` deve ser `0`; avisos
em `JWT_SECRET` ou `INTEGRATION_SECRET_KEY` indicam segredo ausente/curto e
devem ser resolvidos antes de rodar com `NODE_ENV=production`.

## Proxy HTTP

Exemplo de Nginx para publicar o Next em `192.168.58.159`:

```nginx
server {
    listen 80;
    server_name 192.168.58.159;

    client_max_body_size 20m;

    location = /api/auth/web-session {
        proxy_pass http://127.0.0.1:3010/api/auth/web-session;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Teste e recarregue:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I http://192.168.58.159/login
```

## Rollback

Se algo falhar, volte o proxy para o arquivo de configuracao salvo no backup e recarregue o webserver:

```bash
sudo systemctl stop nova-web nova-api
sudo nginx -t && sudo systemctl reload nginx
```

Nao remova o legado ate validar login, cadastros, operacao, reconciliacao e relatorios usados pela equipe.

## Checklist antes da troca final

- `corepack pnpm check:deploy` passou no repositorio.
- `curl http://127.0.0.1:4000/health/ready` retorna `ok: true` e
  `summary.failed: 0` no servidor.
- Login com usuario administrador funciona em `http://192.168.58.159/login`.
- Endpoints de compatibilidade `/api/health`, `/api/dashboard`, `/api/audits`,
  `/api/starlinks`, `/api/import/templates/units` e `/api/export/partners`
  respondem no servidor.
- Rotas web `/equipamentos/starlinks`, `/operacao/importacao` e
  `/export/equipments` respondem autenticadas pelo Next.
- Upload e download de anexos foram testados em pelo menos uma unidade ou
  equipamento.
- Dados principais migrados/importados ou plano de convivencia definido.
- Backup do legado feito e caminho de rollback testado.
