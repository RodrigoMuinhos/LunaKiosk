.PHONY: help build start stop restart logs status test-ghl clean dev prod

# Default target
help:
	@echo "========================================="
	@echo "  Docker Build & Deploy - Sistema Luna"
	@echo "========================================="
	@echo ""
	@echo "Comandos disponíveis:"
	@echo "  make build       - Build todos os serviços"
	@echo "  make start       - Iniciar todos os serviços"
	@echo "  make stop        - Parar todos os serviços"
	@echo "  make restart     - Reiniciar todos os serviços"
	@echo "  make logs        - Ver logs em tempo real"
	@echo "  make status      - Ver status dos containers"
	@echo "  make test-ghl    - Testar webhook GHL"
	@echo "  make clean       - Limpar containers e volumes"
	@echo "  make dev         - Build + Start (modo dev)"
	@echo "  make prod        - Build + Start (modo prod)"
	@echo ""

# Build all services
build:
	@echo "🔨 Building all services..."
	docker-compose build
	@echo "✅ Build completed!"

# Start all services
start:
	@echo "🚀 Starting all services..."
	docker-compose up -d
	@echo "✅ Services started!"
	@sleep 5
	@make status

# Stop all services
stop:
	@echo "🛑 Stopping all services..."
	docker-compose down
	@echo "✅ Services stopped!"

# Restart all services
restart:
	@echo "🔄 Restarting all services..."
	docker-compose restart
	@echo "✅ Services restarted!"
	@sleep 3
	@make status

# Show logs
logs:
	@echo "📋 Showing logs (Ctrl+C to exit)..."
	docker-compose logs -f --tail=100

# Show logs for specific service
logs-totemapi:
	docker-compose logs -f --tail=100 totemapi

logs-lunacore:
	docker-compose logs -f --tail=100 lunacore

logs-lunapay:
	docker-compose logs -f --tail=100 lunapay

logs-totemui:
	docker-compose logs -f --tail=100 totemui

# Show status
status:
	@echo "📊 Container Status:"
	@docker-compose ps
	@echo ""
	@echo "🌐 Service URLs:"
	@echo "  LunaCore:  http://localhost:8080"
	@echo "  TotemAPI:  http://localhost:8081"
	@echo "  LunaPay:   http://localhost:8082"
	@echo "  TotemUI:   http://localhost:3000"
	@echo ""
	@echo "🔗 Webhook GHL:"
	@echo "  URL:   http://localhost:8081/api/webhooks/ghl/patients"
	@echo "  Token: ln16012x26"

# Test GHL webhook
test-ghl:
	@echo "🧪 Testing GHL Webhook..."
	@powershell -ExecutionPolicy Bypass -File "./test-webhook-ghl.ps1" -TestNumber 1

# Clean everything
clean:
	@echo "🧹 Cleaning everything..."
	docker-compose down -v --remove-orphans
	@echo "✅ Cleanup complete!"

# Development mode (build + start + logs)
dev: build start
	@echo "🔧 Development mode - showing logs..."
	@make logs

# Production mode (build + start)
prod:
	@echo "🚀 Production mode..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
	@make status

# Health check
health:
	@echo "🏥 Health Check:"
	@curl -s http://localhost:8080/actuator/health | jq . || echo "LunaCore: ❌"
	@curl -s http://localhost:8081/actuator/health | jq . || echo "TotemAPI: ❌"
	@curl -s http://localhost:8082/actuator/health | jq . || echo "LunaPay: ❌"

# Database migrations (if needed)
db-migrate:
	@echo "🗄️  Running database migrations..."
	docker-compose exec totemapi ./mvnw flyway:migrate

# Backup database
db-backup:
	@echo "💾 Backing up database..."
	@docker-compose exec -T postgres pg_dump -U luna luna > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup completed!"

# Shell access
shell-totemapi:
	docker-compose exec totemapi sh

shell-lunacore:
	docker-compose exec lunacore sh

shell-lunapay:
	docker-compose exec lunapay sh
