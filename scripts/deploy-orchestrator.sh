#!/bin/bash

# Quick deployment script for the Orchestrator to different platforms
# Usage: ./deploy.sh [platform] [env-file]
# Example: ./deploy.sh railway services/orchestrator/.env.production

set -e

PLATFORM=${1:-railway}
ENV_FILE=${2:-services/orchestrator/.env.production}

echo "🚀 Deploying Orchestrator to $PLATFORM..."

# Validate environment file
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    echo "   Copy from .env.production.example and fill in your values"
    exit 1
fi

case $PLATFORM in
    railway)
        echo "📦 Railway.app deployment..."
        if ! command -v railway &> /dev/null; then
            echo "❌ railway CLI not installed. Install from https://docs.railway.app/cli"
            exit 1
        fi
        
        cd services/orchestrator
        railway login
        railway link
        
        # Load env vars
        while IFS= read -r line; do
            if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
                railway config set $line
            fi
        done < "../../$ENV_FILE"
        
        # Push and deploy
        cd ../..
        git push origin main
        echo "✅ Deployment initiated on Railway. Check dashboard at https://railway.app"
        ;;
        
    heroku)
        echo "📦 Heroku deployment..."
        if ! command -v heroku &> /dev/null; then
            echo "❌ heroku CLI not installed. Install from https://devcenter.heroku.com/articles/heroku-cli"
            exit 1
        fi
        
        cd services/orchestrator
        heroku login
        APP_NAME="agent-marketplace-orchestrator-$(date +%s)"
        heroku create $APP_NAME
        
        # Load env vars
        while IFS= read -r line; do
            if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
                heroku config:set $line -a $APP_NAME
            fi
        done < "../../$ENV_FILE"
        
        # Deploy
        cd ../..
        git push heroku main
        heroku open -a $APP_NAME
        echo "✅ Deployed to Heroku: https://$APP_NAME.herokuapp.com"
        ;;
        
    fly)
        echo "📦 Fly.io deployment..."
        if ! command -v flyctl &> /dev/null; then
            echo "❌ flyctl CLI not installed. Install from https://fly.io/docs/getting-started/installing-flyctl/"
            exit 1
        fi
        
        cd services/orchestrator
        APP_NAME="agent-marketplace-orchestrator"
        
        # Create/launch if needed
        flyctl launch --name $APP_NAME --region sjc 2>/dev/null || true
        
        # Set secrets
        while IFS= read -r line; do
            if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
                KEY="${line%%=*}"
                VALUE="${line#*=}"
                flyctl secrets set "$KEY=$VALUE"
            fi
        done < "../../$ENV_FILE"
        
        cd ../..
        flyctl deploy
        echo "✅ Deployed to Fly.io: https://$APP_NAME.fly.dev"
        ;;
        
    docker)
        echo "📦 Docker build..."
        cd services/orchestrator
        
        # Build
        REGISTRY=${DOCKER_REGISTRY:-"your-registry"}
        IMAGE_NAME="$REGISTRY/orchestrator:latest"
        
        docker build -t $IMAGE_NAME .
        
        echo "✅ Docker image built: $IMAGE_NAME"
        echo ""
        echo "To push to registry:"
        echo "  docker push $IMAGE_NAME"
        echo ""
        echo "To run locally:"
        echo "  docker run -d \\"
        echo "    --env-file ../../$ENV_FILE \\"
        echo "    -p 5000:5000 \\"
        echo "    $IMAGE_NAME"
        ;;
        
    *)
        echo "❌ Unknown platform: $PLATFORM"
        echo ""
        echo "Supported platforms:"
        echo "  railway  - Railway.app (recommended)"
        echo "  heroku   - Heroku"
        echo "  fly      - Fly.io"
        echo "  docker   - Docker (self-hosted)"
        exit 1
        ;;
esac
