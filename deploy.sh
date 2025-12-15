#!/bin/bash
set -e

echo "🚀 Starting TFLH Backend Deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/tflh-backend"
REPO_URL="YOUR_GIT_REPO_URL"  # Replace with your repo
BRANCH="main"

echo -e "${YELLOW}📦 Step 1: Cleaning up old projects${NC}"

# Stop and remove old containers
echo "Stopping old containers..."
docker ps -a | grep -v CONTAINER | awk '{print $1}' | xargs -r docker stop || true
docker ps -a | grep -v CONTAINER | awk '{print $1}' | xargs -r docker rm || true

# Remove old images (keep last 2 to save space)
echo "Cleaning old Docker images..."
docker images | grep -v REPOSITORY | sort -k4 -r | tail -n +3 | awk '{print $3}' | xargs -r docker rmi -f || true

# Clean up old SQLite databases (backup first)
echo "Backing up old databases..."
find / -name "*.db" -type f 2>/dev/null | while read db; do
    if [[ "$db" != *"$APP_DIR"* ]]; then
        backup_name="${db}.backup.$(date +%Y%m%d)"
        cp "$db" "$backup_name" 2>/dev/null || true
    fi
done

# Clean Docker system
docker system prune -af --volumes || true

echo -e "${GREEN}✅ Cleanup completed${NC}"

echo -e "${YELLOW}📥 Step 2: Preparing application directory${NC}"

# Create app directory if doesn't exist
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or pull repository
if [ -d ".git" ]; then
    echo "Pulling latest changes..."
    git fetch origin
    git reset --hard origin/$BRANCH
    git pull origin $BRANCH
else
    echo "Cloning repository..."
    git clone -b $BRANCH $REPO_URL .
fi

echo -e "${GREEN}✅ Code updated${NC}"

echo -e "${YELLOW}🐳 Step 3: Building Docker image${NC}"

# Build Docker image (simplified for compatibility)
docker build -t tflh-backend:latest .

echo -e "${GREEN}✅ Docker image built${NC}"

echo -e "${YELLOW}🚢 Step 4: Starting application${NC}"

# Create data directory for SQLite
mkdir -p $APP_DIR/data
chmod 777 $APP_DIR/data

# Start with docker-compose
docker-compose up -d

echo -e "${GREEN}✅ Application started${NC}"

echo -e "${YELLOW}⏳ Step 5: Waiting for application to be healthy${NC}"

# Wait for health check
sleep 10
for i in {1..30}; do
    if docker ps | grep -q tflh-backend && docker inspect --format='{{.State.Health.Status}}' tflh-backend 2>/dev/null | grep -q "healthy"; then
        echo -e "${GREEN}✅ Application is healthy!${NC}"
        break
    fi
    echo "Waiting for health check... ($i/30)"
    sleep 2
done

# Show logs
echo -e "${YELLOW}📋 Recent logs:${NC}"
docker logs --tail 20 tflh-backend

# Show container status
echo -e "${YELLOW}📊 Container status:${NC}"
docker ps | grep tflh

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${YELLOW}Backend running at: http://YOUR_DOMAIN:3000${NC}"
echo -e "${YELLOW}WebSocket available at: ws://YOUR_DOMAIN:3000/ws${NC}"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  View logs: docker logs -f tflh-backend"
echo "  Restart: docker-compose restart"
echo "  Stop: docker-compose down"
echo "  Check health: docker inspect --format='{{.State.Health.Status}}' tflh-backend"
