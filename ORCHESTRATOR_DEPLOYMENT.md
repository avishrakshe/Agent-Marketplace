# Orchestrator Backend Deployment Guide

This guide covers deploying the FastAPI Orchestrator service to production platforms.

## Overview

The **Orchestrator** is a FastAPI service that:
- Orchestrates AI agent tasks across multiple specialist services
- Manages onchain payments via EIP-3009 (transferWithAuthorization)
- Reads from smart contracts (IdentityRegistry, ReputationRegistry, PaymentSettlement)
- Streams progress updates via Server-Sent Events (SSE)
- Requires access to an RPC endpoint and blockchain contracts

---

## Prerequisites

Before deploying, ensure you have:

1. **Smart contracts deployed** on your target blockchain
   - IdentityRegistry, ReputationRegistry, PaymentSettlement, TestUSDC
   - Contract addresses & ABIs in `shared/deployed.json`

2. **RPC Endpoint** (public or private)
   - Avalanche Fuji Testnet: `https://api.avax-testnet.network/ext/bc/C/rpc`
   - Avalanche Mainnet: `https://api.avax.network/ext/bc/C/rpc`
   - Local Avalanche Subnet-EVM: Configure URL

3. **Wallet Private Keys**
   - Orchestrator wallet (must have tUSDC balance for payments)
   - Fund the orchestrator wallet before launching

4. **Specialist Services URLs** (summarizer, translator, auditor, etc.)
   - If running specialist agents separately, they must be accessible from the orchestrator

---

## Environment Variables

Create a `.env` file in `services/orchestrator/` with:

```env
# Blockchain RPC
RPC_URL=https://api.avax-testnet.network/ext/bc/C/rpc
CHAIN_ID=43113

# Orchestrator wallet
ORCHESTRATOR_PRIVATE_KEY=0x...

# Payment settings
MIN_REPUTATION_SCORE=50
SESSION_SPEND_CAP=1.0

# Optional: Specialist service URLs (if running separately)
SUMMARIZER_URL=https://summarizer.example.com
TRANSLATOR_URL=https://translator.example.com
```

**⚠️ Never commit private keys!** Use platform secrets instead.

---

## Deployment Options

### Option 1: Railway.app (Recommended for quick setup)

**Pros:** Simple, auto-deploys from GitHub, built-in secrets  
**Cost:** $5/month or pay-as-you-go

#### Steps:

1. **Create Railway account** → https://railway.app

2. **Connect GitHub repo**
   - New Project → Deploy from GitHub
   - Select `avishrakshe/Agent-Marketplace`

3. **Set root directory**
   - Settings → Root Directory → `services/orchestrator`

4. **Configure environment**
   - Variables → Add:
     ```
     RPC_URL=https://api.avax-testnet.network/ext/bc/C/rpc
     CHAIN_ID=43113
     ORCHESTRATOR_PRIVATE_KEY=0x...
     MIN_REPUTATION_SCORE=50
     SESSION_SPEND_CAP=1.0
     ```

5. **Configure start command**
   - Settings → Start Command:
     ```bash
     pip install -r requirements.txt && python main.py
     ```

6. **Port**
   - Railway auto-exposes port 5000

7. **Deploy**
   - Push to GitHub or click "Deploy" in dashboard
   - Railway automatically builds and deploys

#### Access:
```
https://<project-name>.up.railway.app
```

---

### Option 2: Heroku (Classic, but paid)

**Pros:** Battle-tested, good docs  
**Cost:** $7/month minimum (no free tier as of 2024)

#### Steps:

1. **Create Procfile** in `services/orchestrator/`:
   ```
   web: python main.py
   ```

2. **Deploy with Heroku CLI**
   ```bash
   cd services/orchestrator
   heroku create <app-name>
   heroku config:set RPC_URL=https://api.avax-testnet.network/ext/bc/C/rpc
   heroku config:set CHAIN_ID=43113
   heroku config:set ORCHESTRATOR_PRIVATE_KEY=0x...
   heroku config:set MIN_REPUTATION_SCORE=50
   git push heroku main
   ```

3. **View logs**
   ```bash
   heroku logs --tail
   ```

#### Access:
```
https://<app-name>.herokuapp.com
```

---

### Option 3: AWS Lambda + API Gateway (Serverless)

**Pros:** Scales automatically, pay-per-use  
**Cost:** Free tier covers low traffic; ~$1-5/month for moderate use

#### Steps:

1. **Refactor for Lambda**
   - Install: `pip install mangum`
   - Create `lambda_handler.py`:
     ```python
     from mangum import Mangum
     from main import app
     
     handler = Mangum(app)
     ```

2. **Deploy with AWS CLI or Serverless Framework**
   ```bash
   npm install -g serverless
   serverless create --template aws-python
   serverless deploy --param="rpcUrl=https://api.avax-testnet.network/ext/bc/C/rpc" \
     --param="chainId=43113" \
     --param="orchestratorPrivateKey=0x..."
   ```

3. **Alternative: AWS SAM**
   ```bash
   sam build
   sam deploy --guided
   ```

#### Access:
```
https://<api-id>.execute-api.<region>.amazonaws.com/orchestrator
```

---

### Option 4: Fly.io (Fast, global)

**Pros:** Super fast, edge deployment, generous free tier  
**Cost:** Free tier + $0.50/GB RAM beyond free

#### Steps:

1. **Create Dockerfile** in `services/orchestrator/`:
   ```dockerfile
   FROM python:3.12-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   COPY . .
   EXPOSE 5000
   CMD ["python", "main.py"]
   ```

2. **Deploy**
   ```bash
   flyctl launch
   flyctl config set env RPC_URL=https://api.avax-testnet.network/ext/bc/C/rpc
   flyctl secrets set ORCHESTRATOR_PRIVATE_KEY=0x...
   flyctl deploy
   ```

#### Access:
```
https://<app-name>.fly.dev
```

---

### Option 5: Docker + Self-Hosted VPS

**Pros:** Full control, no vendor lock-in  
**Cost:** $5-20/month (DigitalOcean, Linode, Vultr)

#### Steps:

1. **Build Docker image**
   ```bash
   cd services/orchestrator
   docker build -t orchestrator:latest .
   ```

2. **Push to registry**
   ```bash
   docker tag orchestrator:latest your-registry/orchestrator:latest
   docker push your-registry/orchestrator:latest
   ```

3. **Deploy on VPS**
   ```bash
   ssh user@your-vps.com
   docker pull your-registry/orchestrator:latest
   docker run -d \
     -e RPC_URL=https://api.avax-testnet.network/ext/bc/C/rpc \
     -e CHAIN_ID=43113 \
     -e ORCHESTRATOR_PRIVATE_KEY=0x... \
     -p 5000:5000 \
     --name orchestrator \
     your-registry/orchestrator:latest
   ```

4. **Setup reverse proxy (Nginx)**
   ```nginx
   server {
     listen 80;
     server_name orchestrator.example.com;

     location / {
       proxy_pass http://localhost:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_buffering off;
     }
   }
   ```

---

## Updating Smart Contract Addresses

If you redeploy contracts:

1. **Update `shared/deployed.json`** with new contract addresses and ABIs

2. **Redeploy orchestrator** (it reads from `deployed.json` at startup)

   **Railway:**
   ```bash
   git push origin main  # Triggers auto-redeploy
   ```

   **Heroku:**
   ```bash
   git push heroku main
   ```

   **Docker:**
   ```bash
   docker pull your-registry/orchestrator:latest
   docker stop orchestrator
   docker run ... (with updated deployed.json)
   ```

---

## Connecting Frontend to Deployed Orchestrator

Update [frontend/.env.production](frontend/.env.production):

```env
NEXT_PUBLIC_ORCHESTRATOR_URL=https://<deployed-orchestrator-url>
NEXT_PUBLIC_RPC_URL=https://api.avax-testnet.network/ext/bc/C/rpc
CHAIN_ID=43113
```

Then deploy frontend to Vercel:

```bash
cd frontend
npm install
npm run build
vercel --prod
```

---

## Testing Deployment

After deployment, verify the orchestrator is working:

```bash
# Health check
curl https://<orchestrator-url>/health 2>/dev/null || echo "No health endpoint"

# Get balance
curl -X POST https://<orchestrator-url>/balance \
  -H "Content-Type: application/json" \
  -d '{"address": "0x..."}'

# Test task (streaming)
curl -X POST https://<orchestrator-url>/task \
  -H "Content-Type: application/json" \
  -d '{"task": "Summarize: Hello world"}' \
  -N  # no buffering
```

---

## Monitoring & Debugging

### Check Logs

**Railway:**
```bash
railway logs
```

**Heroku:**
```bash
heroku logs --tail
```

**Fly.io:**
```bash
flyctl logs
```

**Docker:**
```bash
docker logs orchestrator
```

### Common Issues

| Issue | Solution |
|-------|----------|
| **Private key rejected** | Ensure key is hex-encoded (0x...) and has valid checksum |
| **Contract not found** | Verify `shared/deployed.json` exists and has correct addresses |
| **RPC timeout** | Check RPC endpoint is accessible; may need rate limit handling |
| **Wallet insufficient balance** | Fund orchestrator wallet with tUSDC before running |
| **CORS errors** | Orchestrator has `allow_origins=["*"]`; check frontend URL in browser console |

### Performance Tuning

- **Workers**: Railway/Heroku auto-scale; increase with config
- **Timeout**: FastAPI default 60s; may need increase for complex tasks
- **Rate limiting**: Add if needed:
  ```python
  from slowapi import Limiter
  from slowapi.util import get_remote_address
  
  limiter = Limiter(key_func=get_remote_address)
  app.state.limiter = limiter
  ```

---

## Scaling Beyond Single Orchestrator

For high-traffic deployments:

1. **Load balancer** (Nginx, HAProxy)
2. **Multiple orchestrator instances** (same wallet OK; just ensure sequential txs)
3. **Redis cache** for contract reads
4. **Specialist agents behind load balancer** too

---

## Security Checklist

- [ ] Private keys stored in platform secrets (not in `.env` files)
- [ ] RPC endpoint is reliable & rate-limited if needed
- [ ] Wallet has only minimum balance needed
- [ ] CORS configured appropriately (restrict if sensitive)
- [ ] Monitor for unauthorized task submissions
- [ ] Rate limit or auth-token protect `/task` endpoint if needed
- [ ] Regularly rotate private keys if compromised

---

## Support & Troubleshooting

For issues:

1. Check [README.md](README.md) for architecture overview
2. Review `services/orchestrator/main.py` logic
3. Verify RPC endpoint is responding
4. Check blockchain explorer for transaction failures
5. Enable debug logging: `os.environ['DEBUG'] = '1'`

---

## Next Steps

After deploying:

1. Deploy frontend to Vercel pointing to orchestrator URL
2. Deploy specialist agents (summarizer, translator) if separate
3. Configure DNS/CDN for production URLs
4. Set up monitoring (Datadog, New Relic, Sentry)
5. Create runbooks for common operations
