#!/usr/bin/env bash
#
# Deploy Superset Dashboard on Linux (Ubuntu)
# This script handles:
# - Checking prerequisites (Docker, Docker Compose)
# - Fixing line endings for shell scripts (CRLF -> LF)
# - Building Docker images
# - Starting containers
# - Health checks
#
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Superset Dashboard - Linux Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print info
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to print success
print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Function to print error
print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# ============================================
# 1. Check Prerequisites
# ============================================
print_info "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    echo "Install Docker: https://docs.docker.com/engine/install/ubuntu/"
    exit 1
fi
print_success "Docker found: $(docker --version)"

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed"
    echo "Install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi
print_success "Docker Compose found: $(docker-compose --version)"

# ============================================
# 2. Check disk space
# ============================================
print_info "Checking disk space..."
AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_SPACE" -lt 5242880 ]; then  # Less than 5GB
    print_warning "Low disk space: $(numfmt --to=iec $AVAILABLE_SPACE) available"
    print_warning "Building Docker images requires at least 5GB free space"
fi
print_success "Disk space OK: $(numfmt --to=iec $AVAILABLE_SPACE) available"

# ============================================
# 3. Configure Git for proper line endings
# ============================================
print_info "Configuring git for proper line endings..."
git config core.autocrlf false
print_success "Git autocrlf disabled"

# Reset shell scripts to ensure LF line endings
print_info "Resetting shell scripts to have LF line endings..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    git checkout -- docker/*.sh 2>/dev/null || true
    print_success "Shell scripts line endings reset"
else
    print_warning "Not a git repository, skipping git checkout"
fi

# Manual fix: convert any CRLF to LF in shell scripts
print_info "Converting any remaining CRLF to LF in shell scripts..."
find docker -name "*.sh" -type f -exec sed -i 's/\r$//' {} \;
print_success "Shell scripts line endings converted"

# ============================================
# 4. Fix permissions on shell scripts
# ============================================
print_info "Setting execute permissions on shell scripts..."
find docker -name "*.sh" -type f -exec chmod 755 {} \;
ls -la docker/*.sh | head -3
print_success "Shell scripts permissions fixed"

# ============================================
# 5. Create necessary directories
# ============================================
print_info "Creating necessary directories..."
mkdir -p docker/.env 2>/dev/null || true

# Check if docker/.env exists, if not create from template
if [ ! -f docker/.env ]; then
    print_info "Creating docker/.env file..."
    cat > docker/.env << 'EOF'
# Superset configuration
COMPOSE_PROJECT_NAME=dashboard
SUPERSET_ENV=development
FLASK_DEBUG=true
FLASK_APP=superset.app:create_app()
PYTHONPATH=/app/pythonpath
SUPERSET_PORT=8088
SUPERSET_LOAD_EXAMPLES=no
CYPRESS_CONFIG=false

# Database configuration
DATABASE_DIALECT=postgresql
DATABASE_USER=superset
DATABASE_PASSWORD=superset
DATABASE_HOST=db
DATABASE_PORT=5432
DATABASE_DB=superset

# Redis configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Ports
NGINX_PORT=81
NODE_PORT=9000
WEBSOCKET_PORT=8080
CYPRESS_PORT=8081

# Build options
INCLUDE_CHROMIUM=false
INCLUDE_FIREFOX=false
BUILD_TRANSLATIONS=false

# Secret key (change this in production!)
SUPERSET_SECRET_KEY=CHANGE_ME_IN_PRODUCTION
EOF
    print_success "Created docker/.env file"
else
    print_success "docker/.env already exists"
fi

# ============================================
# 6. Clean up old Docker data (optional)
# ============================================
print_info "Checking Docker system usage..."
DOCKER_USAGE=$(docker system df --format "{{.TotalReclaimableSpace}}" 2>/dev/null || echo "0")
if [ "$DOCKER_USAGE" != "0" ]; then
    print_warning "Docker has reclaimable space: $DOCKER_USAGE"
    read -p "Do you want to clean up unused Docker data? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Pruning unused Docker images and containers..."
        docker system prune --force --volumes
        print_success "Docker system pruned"
    fi
fi

# ============================================
# 7. Build Docker images
# ============================================
print_info "Building Docker images (this may take 5-10 minutes)..."
docker-compose build --no-cache

if [ $? -eq 0 ]; then
    print_success "Docker images built successfully"
else
    print_error "Failed to build Docker images"
    exit 1
fi

# ============================================
# 8. Start Docker containers
# ============================================
print_info "Starting Docker containers..."
docker-compose up -d

if [ $? -eq 0 ]; then
    print_success "Docker containers started"
else
    print_error "Failed to start Docker containers"
    docker-compose logs
    exit 1
fi

# ============================================
# 9. Wait for services to be ready
# ============================================
print_info "Waiting for services to be ready (this may take 2-3 minutes)..."

# Wait for database to be ready
print_info "Waiting for database..."
for i in {1..30}; do
    if docker-compose exec -T db pg_isready -U superset &>/dev/null; then
        print_success "Database is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Database failed to start"
        exit 1
    fi
    echo -n "."
    sleep 2
done

# Wait for superset-init to complete
print_info "Waiting for Superset initialization..."
for i in {1..60}; do
    STATUS=$(docker-compose ps superset-init 2>/dev/null | grep -c "exited" || echo "0")
    if [ "$STATUS" -gt 0 ]; then
        print_success "Superset initialization completed"
        break
    fi
    if [ $i -eq 60 ]; then
        print_warning "Superset initialization timeout (this might be OK if services are running)"
    fi
    echo -n "."
    sleep 2
done

# Wait for superset app to be ready
print_info "Waiting for Superset app..."
for i in {1..30}; do
    if curl -s http://localhost:8088 > /dev/null 2>&1; then
        print_success "Superset app is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_warning "Superset app startup timeout"
    fi
    echo -n "."
    sleep 2
done

# ============================================
# 10. Display service URLs and info
# ============================================
echo ""
print_success "Deployment completed!"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Services are now available at:${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "  ${GREEN}Superset Web UI${NC}:         http://localhost:8088"
echo -e "  ${GREEN}Nginx Reverse Proxy${NC}:    http://localhost:81"
echo -e "  ${GREEN}Frontend Dev Server${NC}:    http://localhost:9000"
echo -e "  ${GREEN}WebSocket Server${NC}:       http://localhost:8080"
echo ""
echo -e "${BLUE}Default Credentials:${NC}"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View logs:              docker-compose logs -f [service]"
echo "  Stop services:          docker-compose down"
echo "  Restart services:       docker-compose restart"
echo "  Connect to database:    docker-compose exec db psql -U superset -d superset"
echo ""
echo -e "${BLUE}Database Info:${NC}"
echo "  Host:       db"
echo "  Port:       5432"
echo "  User:       superset"
echo "  Password:   superset"
echo "  Database:   superset"
echo ""

# Show container status
print_info "Container status:"
docker-compose ps

# Tail logs
print_info "Starting to show logs (press Ctrl+C to stop)..."
docker-compose logs -f
