# 🚀 Deployment-Anleitung - Mitarbeiter-Notizen-App

## Übersicht

Diese Anleitung zeigt Ihnen zwei Wege, wie Sie die App auf Ihrem eigenen Ubuntu 24.04-Server deployen können:

1. **Automatisches Deployment** (Empfohlen) - Mit dem mitgelieferten Skript
2. **Manuelles Deployment** - Schritt für Schritt

---

## ⚡ Option 1: Automatisches Deployment (Empfohlen)

### Voraussetzungen
- Ubuntu 24.04 Server
- Root oder sudo-Zugriff
- Domain, die auf Ihren Server zeigt (für SSL)
- Mindestens 2 GB RAM
- 10 GB freier Festplattenspeicher

### Installation

**Schritt 1:** Laden Sie das Projekt auf Ihren Server hoch
```bash
# Via SCP von Ihrem lokalen Rechner
scp -r /pfad/zu/app root@ihr-server:/root/

# Oder via Git (wenn in Repository)
git clone https://github.com/ihr-username/employee-notes-app.git
cd employee-notes-app
```

**Schritt 2:** Führen Sie das Deployment-Skript aus
```bash
cd /app
sudo bash deploy.sh
```

**Schritt 3:** Folgen Sie den Anweisungen
- Geben Sie Ihre Domain ein (z.B. `notes.ihrefirma.de`)
- Geben Sie Ihre Email für SSL ein
- Bestätigen Sie die Installation

**Fertig!** Die App ist nach ~10 Minuten unter Ihrer Domain verfügbar.

### Standard-Login nach Installation:
- **Admin:** admin@admin.de / admin2024
- **⚠️ WICHTIG:** Ändern Sie das Passwort sofort nach dem ersten Login!

---

## 🔧 Option 2: Manuelles Deployment

### Schritt 1: System-Update
```bash
sudo apt update && sudo apt upgrade -y
```

### Schritt 2: Node.js 20 installieren
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn
```

### Schritt 3: Python 3.11 installieren
```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
```

### Schritt 4: MongoDB installieren
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Schritt 5: Nginx installieren
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Schritt 6: App-Verzeichnis erstellen
```bash
sudo mkdir -p /opt/employee-notes
sudo chown $USER:$USER /opt/employee-notes
cd /opt/employee-notes
```

### Schritt 7: Backend einrichten
```bash
# Kopieren Sie Ihre Backend-Dateien nach /opt/employee-notes/backend/

cd /opt/employee-notes
python3.11 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### Schritt 8: Backend .env konfigurieren
```bash
nano /opt/employee-notes/backend/.env
```

Inhalt:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=employee_notes_production
CORS_ORIGINS=http://ihre-domain.de,https://ihre-domain.de
JWT_SECRET_KEY=IHR_SICHERER_GEHEIMER_SCHLÜSSEL_HIER
```

Generieren Sie einen sicheren JWT-Schlüssel:
```bash
openssl rand -hex 32
```

### Schritt 9: Frontend einrichten
```bash
cd /opt/employee-notes/frontend

# Frontend .env anpassen
nano .env
```

Inhalt:
```env
REACT_APP_BACKEND_URL=https://ihre-domain.de
```

```bash
# Build Frontend
yarn install
yarn build
```

### Schritt 10: Systemd Service für Backend
```bash
sudo nano /etc/systemd/system/employee-notes-backend.service
```

Inhalt:
```ini
[Unit]
Description=Employee Notes FastAPI Backend
After=network.target mongod.service

[Service]
Type=simple
User=ihr-username
WorkingDirectory=/opt/employee-notes/backend
Environment="PATH=/opt/employee-notes/venv/bin"
ExecStart=/opt/employee-notes/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Ersetzen Sie `ihr-username` mit Ihrem tatsächlichen Benutzernamen!**

Service aktivieren:
```bash
sudo systemctl daemon-reload
sudo systemctl enable employee-notes-backend
sudo systemctl start employee-notes-backend
sudo systemctl status employee-notes-backend
```

### Schritt 11: Nginx konfigurieren
```bash
sudo nano /etc/nginx/sites-available/employee-notes
```

Inhalt:
```nginx
server {
    listen 80;
    server_name ihre-domain.de;
    
    client_max_body_size 20M;

    location / {
        root /opt/employee-notes/frontend/build;
        try_files $uri $uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /api/ {
        proxy_pass http://localhost:8001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Site aktivieren:
```bash
sudo ln -s /etc/nginx/sites-available/employee-notes /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Schritt 12: SSL-Zertifikat (Let's Encrypt)
```bash
sudo certbot --nginx -d ihre-domain.de --email ihre@email.de
```

### Schritt 13: Firewall konfigurieren
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### Schritt 14: Admin-User erstellen
```bash
cd /opt/employee-notes
source venv/bin/activate
python3 -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid
from datetime import datetime, timezone

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

async def create_admin():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['employee_notes_production']
    
    company_id = str(uuid.uuid4())
    company_doc = {
        'id': company_id,
        'name': 'Haupt-Firma',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.companies.insert_one(company_doc)
    
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
    print(f'Admin: admin@admin.de / admin2024')
    print(f'Firmen-ID: {company_id}')
    client.close()

asyncio.run(create_admin())
"
```

---

## 📊 Wartung & Monitoring

### Logs anzeigen
```bash
# Backend-Logs
sudo journalctl -u employee-notes-backend -f

# Nginx-Logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MongoDB-Logs
sudo journalctl -u mongod -f
```

### Services neu starten
```bash
# Backend
sudo systemctl restart employee-notes-backend

# Nginx
sudo systemctl restart nginx

# MongoDB
sudo systemctl restart mongod
```

### Service-Status prüfen
```bash
sudo systemctl status employee-notes-backend
sudo systemctl status nginx
sudo systemctl status mongod
```

### App aktualisieren
```bash
cd /opt/employee-notes

# Backend aktualisieren
source venv/bin/activate
cd backend
git pull  # oder Dateien kopieren
pip install -r requirements.txt
sudo systemctl restart employee-notes-backend

# Frontend aktualisieren
cd ../frontend
git pull  # oder Dateien kopieren
yarn install
yarn build
sudo systemctl restart nginx
```

### Backup erstellen
```bash
# MongoDB Backup
mongodump --db employee_notes_production --out /backup/mongodb/$(date +%Y%m%d)

# App-Dateien Backup
tar -czf /backup/app-$(date +%Y%m%d).tar.gz /opt/employee-notes
```

---

## 🔒 Sicherheit

### SSL erneuern (automatisch)
```bash
# Certbot erneuert automatisch. Testen Sie:
sudo certbot renew --dry-run
```

### MongoDB absichern
```bash
# MongoDB Authentication aktivieren
sudo nano /etc/mongod.conf
```

Fügen Sie hinzu:
```yaml
security:
  authorization: enabled
```

Erstellen Sie Admin-User:
```bash
mongosh
use admin
db.createUser({
  user: "admin",
  pwd: "sicheres-passwort",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})
```

### Regelmäßige Updates
```bash
# System
sudo apt update && sudo apt upgrade -y

# Python-Pakete
cd /opt/employee-notes
source venv/bin/activate
pip list --outdated
pip install --upgrade package-name
```

---

## 🐛 Troubleshooting

### Backend startet nicht
```bash
# Logs prüfen
sudo journalctl -u employee-notes-backend -n 50

# Python-Fehler?
cd /opt/employee-notes
source venv/bin/activate
cd backend
python3 -c "import server"
```

### Frontend zeigt Fehler
```bash
# Build neu erstellen
cd /opt/employee-notes/frontend
rm -rf build node_modules
yarn install
yarn build
```

### MongoDB Verbindungsfehler
```bash
# MongoDB Status
sudo systemctl status mongod

# MongoDB neu starten
sudo systemctl restart mongod

# MongoDB-Logs
sudo journalctl -u mongod -n 50
```

### Nginx 502 Bad Gateway
```bash
# Backend läuft?
sudo systemctl status employee-notes-backend

# Port 8001 offen?
sudo netstat -tulpn | grep 8001
```

---

## 📞 Support

Bei Problemen:
1. Prüfen Sie die Logs (siehe oben)
2. Stellen Sie sicher, dass alle Services laufen
3. Überprüfen Sie die .env-Dateien
4. Testen Sie einzelne Komponenten

---

## 📈 Performance-Optimierung

### PM2 für Backend (Alternative zu systemd)
```bash
npm install -g pm2
cd /opt/employee-notes
source venv/bin/activate
pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001" --name employee-notes
pm2 startup
pm2 save
```

### Redis für Caching (Optional)
```bash
sudo apt install redis-server
sudo systemctl enable redis-server
```

### Monitoring mit Uptime Kuma
```bash
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1
```

---

**Viel Erfolg mit Ihrem Deployment! 🚀**
