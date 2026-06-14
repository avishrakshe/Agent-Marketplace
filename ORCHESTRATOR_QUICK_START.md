# Orchestrator Deployment Quick Reference

## TL;DR — Deploy in 5 Minutes

### 1. Choose Platform & Get URL

| Platform | Time | Cost | Command |
|----------|------|------|---------|
| **Railway** | 2 min | $5/mo | `railway link` → set env → `git push` |
| **Fly.io** | 3 min | Free+ | `flyctl launch` → `flyctl secrets set ...` |
| **Heroku** | 4 min | $7/mo | `heroku create` → `heroku config:set` → `git push heroku` |
| **Docker** | 5 min | $5-20/mo | `docker build` → push → deploy on VPS |

### 2. Configure Environment

Copy & edit `services/orchestrator/.env.production.example`:

```bash
cp services/orchestrator/.env.production.example services/orchestrator/.env.production
```

Fill in:
- `RPC_URL` → Avalanche Fuji RPC
- `CHAIN_ID` → 43113 (testnet) or 43114 (mainnet)
- `ORCHESTRATOR_PRIVATE_KEY` → Your wallet key (0x...)

### 3. Deploy

**Railway (Recommended):**
```bash
npm install -g @railway/cli
railway login
railway link
# Set secrets in dashboard, then:
git push origin main  # Auto-deploys
```

**Fly.io:**
```bash
flyctl launch --name agent-marketplace-orchestrator
flyctl secrets set ORCHESTRATOR_PRIVATE_KEY=0x...
flyctl deploy
```

**Docker:**
```bash
cd services/orchestrator
docker build -t orchestrator:latest .
docker run --env-file .env.production -p 5000:5000 orchestrator:latest
```

### 4. Verify Deployment

```bash
# Test endpoint
curl https://<your-orchestrator-url>/health

# Submit a task
curl -X POST https://<your-orchestrator-url>/task \
  -H "Content-Type: application/json" \
  -d '{"task": "Summarize: Hello world"}'
```

---

## Environment Variables (Required)

```env
RPC_URL=https://api.avax-testnet.network/ext/bc/C/rpc
CHAIN_ID=43113
ORCHESTRATOR_PRIVATE_KEY=0x...
```

---

## Common Deployment URLs

After deploying, your orchestrator will be accessible at:

- **Railway:** `https://<project-name>.up.railway.app`
- **Fly.io:** `https://<app-name>.fly.dev`
- **Heroku:** `https://<app-name>.herokuapp.com`
- **AWS Lambda:** `https://<api-id>.execute-api.<region>.amazonaws.com/orchestrator`
- **Docker (VPS):** `https://orchestrator.yourdomain.com`

---

## Update Frontend to Use Deployed Orchestrator

Edit `frontend/.env.production`:

```env
NEXT_PUBLIC_ORCHESTRATOR_URL=https://<your-orchestrator-url>
NEXT_PUBLIC_RPC_URL=https://api.avax-testnet.network/ext/bc/C/rpc
CHAIN_ID=43113
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Private key rejected | Check format: `0x` + 64 hex chars |
| Contract not found | Verify `shared/deployed.json` has addresses |
| Connection timeout | Check RPC endpoint is accessible |
| 403 Forbidden | Private key may have wrong account |
| Blank response | Check logs: `railway logs` / `flyctl logs` |

---

## Full Documentation

See [ORCHESTRATOR_DEPLOYMENT.md](ORCHESTRATOR_DEPLOYMENT.md) for:
- Detailed step-by-step for each platform
- Scaling & monitoring setup
- Security checklist
- Troubleshooting guide

---

## Support

- Repository: https://github.com/avishrakshe/Agent-Marketplace
- Issues: GitHub Issues
- Docs: ORCHESTRATOR_DEPLOYMENT.md, README.md
