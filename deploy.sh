#!/bin/bash
#
# Mitarbeiter-Notizen-App - Komplettes Deployment-Skript für Ubuntu 24.04
# Dieses Skript installiert und konfiguriert alles automatisch
#

set -e

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Mitarbeiter-Notizen-App Deployment Script          ║${NC}"
echo -e "${GREEN}║   Ubuntu 24.04 Server                                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# Frage nach Domain
read -p "Geben Sie Ihre Domain ein (z.B. notes.ihredomain.de): " DOMAIN
read -p "Geben Sie Ihre Email für SSL-Zertifikat ein: " EMAIL

# Bestätigung
echo ""
echo -e "${YELLOW}Konfiguration:${NC}"
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""
read -p "Fortfahren? (j/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Jj]$ ]]
then
    echo "Abgebrochen."
    exit 1
fi

echo ""
echo -e "${GREEN}[1/10] System-Update...${NC}"
sudo apt update && sudo apt upgrade -y

echo ""
echo -e "${GREEN}[2/10] Installation von Basis-Paketen...${NC}"
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx build-essential

echo ""
echo -e "${GREEN}[3/10] Installation von Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Yarn installieren
sudo npm install -g yarn

echo ""
echo -e "${GREEN}[4/10] Installation von Python 3.11 und venv...${NC}"
sudo apt install -y python3.11 python3.11-venv python3-pip

echo ""
echo -e "${GREEN}[5/10] Installation von MongoDB 7.0...${NC}"
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# MongoDB starten
sudo systemctl start mongod
sudo systemctl enable mongod

echo ""
echo -e "${GREEN}[6/10] Erstelle App-Verzeichnis und Setup...${NC}"
APP_DIR="/opt/employee-notes"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Kopiere App-Dateien
cp -r /app/backend $APP_DIR/
cp -r /app/frontend $APP_DIR/

cd $APP_DIR

# Python Virtual Environment
echo ""
echo -e "${GREEN}[7/10] Setup Python Backend...${NC}"
python3.11 -m venv venv
source venv/bin/activate

# Python Dependencies installieren
pip install --upgrade pip
pip install -r backend/requirements.txt

# Environment-Variablen konfigurieren
cat > backend/.env <<EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=employee_notes_production
CORS_ORIGINS=http://$DOMAIN,https://$DOMAIN
JWT_SECRET_KEY=$(openssl rand -hex 32)
EOF

echo ""
echo -e "${GREEN}[8/10] Setup React Frontend...${NC}"
cd $APP_DIR/frontend

# Update Frontend .env mit echter Domain
cat > .env <<EOF
REACT_APP_BACKEND_URL=https://$DOMAIN
EOF

# Frontend Build
yarn install
yarn build

echo ""
echo -e "${GREEN}[9/10] Erstelle Systemd Services...${NC}"

# Backend Service
sudo tee /etc/systemd/system/employee-notes-backend.service > /dev/null <<EOF
[Unit]
Description=Employee Notes FastAPI Backend
After=network.target mongod.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/venv/bin"
ExecStart=$APP_DIR/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Nginx Konfiguration
sudo tee /etc/nginx/sites-available/employee-notes > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    client_max_body_size 20M;

    # Serve React frontend
    location / {
        root $APP_DIR/frontend/build;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy API requests to FastAPI
    location /api/ {
        proxy_pass http://localhost:8001/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/employee-notes /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx
sudo nginx -t

echo ""
echo -e "${GREEN}[10/10] Starte Services...${NC}"

# Services aktivieren und starten
sudo systemctl daemon-reload
sudo systemctl enable employee-notes-backend
sudo systemctl start employee-notes-backend
sudo systemctl restart nginx

# Warte kurz
sleep 3

# Check Service Status
if sudo systemctl is-active --quiet employee-notes-backend; then
    echo -e "${GREEN}✅ Backend Service läuft${NC}"
else
    echo -e "${RED}❌ Backend Service Problem${NC}"
    sudo journalctl -u employee-notes-backend -n 20
fi

if sudo systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx läuft${NC}"
else
    echo -e "${RED}❌ Nginx Problem${NC}"
fi

echo ""
echo -e "${GREEN}[SSL] Setup SSL-Zertifikat...${NC}"
echo ""
echo -e "${YELLOW}WICHTIG: Stellen Sie sicher, dass Ihre Domain $DOMAIN bereits auf diesen Server zeigt!${NC}"
read -p "Domain zeigt auf diesen Server? SSL jetzt einrichten? (j/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]
then
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect
    echo -e "${GREEN}✅ SSL-Zertifikat installiert${NC}"
else
    echo -e "${YELLOW}⚠ SSL übersprungen. Führen Sie später aus: sudo certbot --nginx -d $DOMAIN${NC}"
fi

# Firewall konfigurieren
echo ""
echo -e "${GREEN}Konfiguriere Firewall...${NC}"
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
echo "y" | sudo ufw enable

# Admin-User erstellen
echo ""
echo -e "${GREEN}Erstelle Admin-User...${NC}"
cd $APP_DIR
source venv/bin/activate

python3 << EOF
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid
from datetime import datetime, timezone

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

async def create_admin():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['employee_notes_production']
    
    # Check if admin exists
    existing = await db.users.find_one({'email': 'admin@admin.de'})
    if existing:
        print('Admin existiert bereits')
        return
    
    # Create company
    company_id = str(uuid.uuid4())
    company_doc = {
        'id': company_id,
        'name': 'Haupt-Firma',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.companies.insert_one(company_doc)
    
    # Create admin
    admin_id = str(uuid.uuid4())
    admin_doc = {
        'id': admin_id,
        'email': 'admin@admin.de',
        'password_hash': pwd_context.hash('admin2024'),
        'company_id': company_id,
        'role': 'admin',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_doc)
    print(f'✅ Admin erstellt: admin@admin.de / admin2024')
    print(f'✅ Firmen-ID: {company_id}')
    
    client.close()

asyncio.run(create_admin())
EOF

echo ""
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           🎉 DEPLOYMENT ERFOLGREICH! 🎉               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Ihre App ist jetzt verfügbar unter:${NC}"
echo -e "${YELLOW}https://$DOMAIN${NC}"
echo ""
echo -e "${GREEN}Admin-Zugangsdaten:${NC}"
echo "Email: admin@admin.de"
echo "Passwort: admin2024"
echo ""
echo -e "${GREEN}Wichtige Befehle:${NC}"
echo "• Backend-Logs: sudo journalctl -u employee-notes-backend -f"
echo "• Backend neu starten: sudo systemctl restart employee-notes-backend"
echo "• Backend Status: sudo systemctl status employee-notes-backend"
echo "• Nginx neu starten: sudo systemctl restart nginx"
echo "• MongoDB Status: sudo systemctl status mongod"
echo ""
echo -e "${GREEN}App-Verzeichnis:${NC} $APP_DIR"
echo -e "${GREEN}Backend .env:${NC} $APP_DIR/backend/.env"
echo ""
echo -e "${YELLOW}⚠ SICHERHEIT: Ändern Sie das Admin-Passwort nach dem ersten Login!${NC}"
echo ""
