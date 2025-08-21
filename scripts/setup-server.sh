#!/bin/bash

# Optica BFF Deployment Script for DigitalOcean
# Run this script on your DigitalOcean droplet to set up the environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root. Run as a regular user with sudo privileges."
    exit 1
fi

print_status "Starting Optica BFF deployment setup on DigitalOcean..."

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    htop \
    ncdu \
    tree

# Install Docker
print_status "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    print_success "Docker installed successfully"
else
    print_warning "Docker is already installed"
fi

# Install Docker Compose
print_status "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose installed successfully"
else
    print_warning "Docker Compose is already installed"
fi

# Configure firewall
print_status "Configuring UFW firewall..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # Application port
sudo ufw allow 8000/tcp  # Coolify port
sudo ufw --force enable
print_success "Firewall configured successfully"

# Configure fail2ban
print_status "Configuring fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Create jail configuration for fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
EOF

sudo systemctl restart fail2ban
print_success "fail2ban configured successfully"

# Install Node.js (for local development/debugging)
print_status "Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_success "Node.js installed successfully"
else
    print_warning "Node.js is already installed"
fi

# Install Coolify
print_status "Installing Coolify..."
if [ ! -d "/data/coolify" ]; then
    curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
    print_success "Coolify installed successfully"
    print_status "Coolify will be available at: http://$(curl -s ifconfig.me):8000"
else
    print_warning "Coolify is already installed"
fi

# Create application directory
print_status "Creating application directory..."
mkdir -p ~/optica-bff
cd ~/optica-bff

# Create environment file template
print_status "Creating environment file template..."
cat > .env.production <<EOF
# Production Environment Variables for Optica BFF
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration (will be provided by Coolify)
DATABASE_URL=postgresql://postgres:password@postgres:5432/optica_bff

# Redis Configuration (will be provided by Coolify)
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=
REDIS_DB=0

# WordPress Integration (CONFIGURE THESE)
WP_GRAPHQL_ENDPOINT=https://your-wordpress-site.com/graphql
WP_BASE_URL=https://your-wordpress-site.com
WOO_CONSUMER_KEY=ck_your_key_here
WOO_CONSUMER_SECRET=cs_your_secret_here
WOO_STORE_API_URL=https://your-wordpress-site.com/wp-json/wc/store/v1

# Security (CHANGE THESE)
JWT_SECRET=your-super-secure-jwt-secret-256-bits-minimum
CORS_ORIGIN=https://your-frontend-domain.com

# Performance Settings
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
CACHE_TTL_PRODUCTS=300
CACHE_TTL_PRODUCT_DETAIL=600
REQUEST_TIMEOUT_MS=15000

# Image Processing
IMAGE_QUALITY=85
IMAGE_MAX_WIDTH=2048
IMAGE_MAX_HEIGHT=1536

# Logging
LOG_LEVEL=info
EOF

print_success "Environment template created at ~/optica-bff/.env.production"

# Create backup directory and script
print_status "Setting up backup system..."
mkdir -p ~/backups
mkdir -p ~/scripts

cat > ~/scripts/backup-db.sh <<'EOF'
#!/bin/bash
# Database backup script for Optica BFF

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/backups"
mkdir -p $BACKUP_DIR

# Get the actual container name (it might have a prefix)
POSTGRES_CONTAINER=$(docker ps --format "table {{.Names}}" | grep postgres | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "Error: PostgreSQL container not found"
    exit 1
fi

echo "Creating backup from container: $POSTGRES_CONTAINER"

# PostgreSQL backup
docker exec $POSTGRES_CONTAINER pg_dump -U postgres optica_bff > $BACKUP_DIR/optica_db_$DATE.sql

if [ $? -eq 0 ]; then
    echo "Backup created successfully: optica_db_$DATE.sql"
    
    # Compress the backup
    gzip $BACKUP_DIR/optica_db_$DATE.sql
    echo "Backup compressed: optica_db_$DATE.sql.gz"
    
    # Keep only last 7 days of backups
    find $BACKUP_DIR -name "optica_db_*.sql.gz" -mtime +7 -delete
    echo "Old backups cleaned up"
else
    echo "Error: Backup failed"
    exit 1
fi

# Optional: Upload to DigitalOcean Spaces
# Uncomment and configure if you want to upload to DO Spaces
# s3cmd put $BACKUP_DIR/optica_db_$DATE.sql.gz s3://your-backup-bucket/
EOF

chmod +x ~/scripts/backup-db.sh

# Set up daily backup cron job
print_status "Setting up daily backup cron job..."
(crontab -l 2>/dev/null; echo "0 2 * * * $HOME/scripts/backup-db.sh >> $HOME/logs/backup.log 2>&1") | crontab -

# Create logs directory
mkdir -p ~/logs

# Create monitoring script
cat > ~/scripts/monitor-app.sh <<'EOF'
#!/bin/bash
# Simple monitoring script for Optica BFF

APP_URL="http://localhost:3000"
LOG_FILE="$HOME/logs/monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Check if application is responding
if curl -f -s $APP_URL/health > /dev/null; then
    echo "[$DATE] Application is healthy" >> $LOG_FILE
else
    echo "[$DATE] ERROR: Application is not responding" >> $LOG_FILE
    
    # Optional: Restart the application
    # docker-compose -f ~/optica-bff/docker-compose.yml restart app
    
    # Optional: Send notification (configure with your preferred method)
    # mail -s "Optica BFF Down" admin@yourdomain.com < /dev/null
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "[$DATE] WARNING: Disk usage is ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.2f", $3/$2 * 100.0)}')
if [ $(echo "$MEMORY_USAGE > 90" | bc -l) -eq 1 ]; then
    echo "[$DATE] WARNING: Memory usage is ${MEMORY_USAGE}%" >> $LOG_FILE
fi
EOF

chmod +x ~/scripts/monitor-app.sh

# Set up monitoring cron job (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * $HOME/scripts/monitor-app.sh") | crontab -

# Install useful monitoring tools
print_status "Installing monitoring tools..."
sudo apt install -y htop iotop nethogs ncdu

# Create system info script
cat > ~/scripts/system-info.sh <<'EOF'
#!/bin/bash
# System information script

echo "=== Optica BFF System Information ==="
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo ""

echo "=== Docker Status ==="
docker --version
docker-compose --version
echo ""

echo "=== Container Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "=== Disk Usage ==="
df -h
echo ""

echo "=== Memory Usage ==="
free -h
echo ""

echo "=== Network Connections ==="
ss -tuln | grep -E ':(3000|5432|6379|8000)'
echo ""

echo "=== Recent Application Logs ==="
if [ -f ~/logs/monitor.log ]; then
    tail -10 ~/logs/monitor.log
else
    echo "No monitor logs found"
fi
EOF

chmod +x ~/scripts/system-info.sh

# Configure log rotation
print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/optica-bff > /dev/null <<EOF
$HOME/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Optimize system settings for Node.js applications
print_status "Optimizing system settings..."
sudo tee -a /etc/sysctl.conf > /dev/null <<EOF

# Optimizations for Node.js applications
vm.swappiness=10
fs.file-max=65536
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.ipv4.tcp_rmem=4096 87380 16777216
net.ipv4.tcp_wmem=4096 65536 16777216
net.core.netdev_max_backlog=5000
net.ipv4.tcp_congestion_control=bbr
EOF

sudo sysctl -p

# Create useful aliases
print_status "Creating useful aliases..."
cat >> ~/.bashrc <<EOF

# Optica BFF aliases
alias optica-logs='docker-compose -f ~/optica-bff/docker-compose.yml logs -f'
alias optica-status='docker-compose -f ~/optica-bff/docker-compose.yml ps'
alias optica-restart='docker-compose -f ~/optica-bff/docker-compose.yml restart'
alias optica-backup='~/scripts/backup-db.sh'
alias optica-info='~/scripts/system-info.sh'
alias optica-monitor='tail -f ~/logs/monitor.log'
EOF

# Create a quick setup verification script
cat > ~/scripts/verify-setup.sh <<'EOF'
#!/bin/bash
# Verify the setup is complete and working

echo "=== Optica BFF Setup Verification ==="
echo ""

# Check Docker
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed: $(docker --version)"
else
    echo "❌ Docker is not installed"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose is installed: $(docker-compose --version)"
else
    echo "❌ Docker Compose is not installed"
fi

# Check Coolify
if [ -d "/data/coolify" ]; then
    echo "✅ Coolify is installed"
    echo "   Access at: http://$(curl -s ifconfig.me):8000"
else
    echo "❌ Coolify is not installed"
fi

# Check firewall
if sudo ufw status | grep -q "Status: active"; then
    echo "✅ UFW firewall is active"
else
    echo "⚠️  UFW firewall is not active"
fi

# Check fail2ban
if systemctl is-active fail2ban &> /dev/null; then
    echo "✅ fail2ban is running"
else
    echo "⚠️  fail2ban is not running"
fi

# Check backup script
if [ -f ~/scripts/backup-db.sh ]; then
    echo "✅ Backup script is created"
else
    echo "❌ Backup script is missing"
fi

# Check cron jobs
if crontab -l | grep -q backup-db.sh; then
    echo "✅ Backup cron job is configured"
else
    echo "❌ Backup cron job is not configured"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Access Coolify at: http://$(curl -s ifconfig.me):8000"
echo "2. Configure your domain DNS to point to this server"
echo "3. Create a new project in Coolify for Optica BFF"
echo "4. Connect your GitHub repository"
echo "5. Configure environment variables in Coolify"
echo "6. Deploy your application"
echo ""
echo "=== Useful Commands ==="
echo "- System info: ~/scripts/system-info.sh"
echo "- Manual backup: ~/scripts/backup-db.sh"
echo "- Monitor logs: tail -f ~/logs/monitor.log"
echo "- Check containers: docker ps"
echo ""
EOF

chmod +x ~/scripts/verify-setup.sh

print_success "Setup completed successfully!"
print_status "Running verification script..."
~/scripts/verify-setup.sh

print_status "Setup summary:"
echo "✅ System updated and optimized"
echo "✅ Docker and Docker Compose installed"
echo "✅ Coolify installed and ready"
echo "✅ Firewall configured (UFW)"
echo "✅ Security hardened (fail2ban)"
echo "✅ Backup system configured"
echo "✅ Monitoring scripts created"
echo "✅ Log rotation configured"
echo ""
print_status "Important files created:"
echo "- Environment template: ~/optica-bff/.env.production"
echo "- Backup script: ~/scripts/backup-db.sh"
echo "- Monitor script: ~/scripts/monitor-app.sh"
echo "- System info script: ~/scripts/system-info.sh"
echo ""
print_success "Server is ready for Optica BFF deployment!"
print_status "Access Coolify at: http://$(curl -s ifconfig.me):8000"
print_warning "Please reboot the server or log out and back in for all changes to take effect."
EOF
