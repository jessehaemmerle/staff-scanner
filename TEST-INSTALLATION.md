# 🧪 Test-Installation - Schritt für Schritt

## Voraussetzungen prüfen

Bevor Sie mit der Installation beginnen, stellen Sie sicher:

### 1. Server-Anforderungen
```bash
# Ubuntu Version prüfen
lsb_release -a
# Sollte: Ubuntu 24.04 oder 22.04 sein

# RAM prüfen
free -h
# Mindestens: 2 GB verfügbar

# Festplattenspeicher prüfen
df -h
# Mindestens: 10 GB frei
```

### 2. Domain-Setup
- ✅ Domain registriert (z.B. `notes.ihrefirma.de`)
- ✅ DNS A-Record zeigt auf Server-IP
- ✅ Propagation abgeschlossen (testen mit `nslookup ihre-domain.de`)

### 3. Server-Zugriff
```bash
# SSH-Zugriff testen
ssh root@ihr-server

# sudo-Rechte prüfen
sudo whoami
# Sollte ausgeben: root
```

---

## Installation Schritt für Schritt

### Schritt 1: Paket auf Server hochladen

**Von Ihrem lokalen Rechner:**

```bash
# 1. Paket von Emergent-Server herunterladen
scp root@emergent-server:/app/employee-notes-app-*.tar.gz .

# 2. Auf Ihren Ubuntu-Server hochladen
scp employee-notes-app-*.tar.gz root@ihr-ubuntu-server:/root/
```

**Alternative: Mit wget (wenn Paket online verfügbar):**
```bash
ssh root@ihr-ubuntu-server
cd /root
wget https://ihre-url/employee-notes-app.tar.gz
```

### Schritt 2: Paket entpacken

```bash
ssh root@ihr-ubuntu-server
cd /root

# Paket entpacken
tar -xzf employee-notes-app-*.tar.gz

# In Verzeichnis wechseln
cd employee-notes-app-*/

# Inhalt prüfen
ls -la
```

**Erwartete Ausgabe:**
```
drwxr-xr-x  backend/
drwxr-xr-x  frontend/
-rwxr-xr-x  deploy.sh
-rw-r--r--  README.md
-rw-r--r--  DEPLOYMENT.md
-rw-r--r--  SCHNELLSTART.md
-rw-r--r--  ARCHITEKTUR.md
-rw-r--r--  INSTALLATION.txt
```

### Schritt 3: Deploy-Skript ausführbar machen

```bash
chmod +x deploy.sh

# Prüfen
ls -l deploy.sh
# Sollte -rwxr-xr-x zeigen (x = ausführbar)
```

### Schritt 4: Installation starten

```bash
sudo ./deploy.sh
```

**Sie werden gefragt:**

1. **Domain eingeben:**
   ```
   Geben Sie Ihre Domain ein (z.B. notes.ihredomain.de): 
   ```
   Eingabe: `notes.ihrefirma.de`

2. **Email eingeben:**
   ```
   Geben Sie Ihre Email für SSL-Zertifikat ein:
   ```
   Eingabe: `admin@ihrefirma.de`

3. **Bestätigung:**
   ```
   Fortfahren? (j/n):
   ```
   Eingabe: `j`

4. **SSL-Setup (am Ende):**
   ```
   Domain zeigt auf diesen Server? SSL jetzt einrichten? (j/n):
   ```
   - Wenn Domain bereits zeigt: `j`
   - Sonst: `n` (später mit `sudo certbot --nginx -d ihre-domain.de`)

### Schritt 5: Installation läuft

Das Skript durchläuft 10 Schritte (~10 Minuten):

```
[1/10] System-Update...
[2/10] Installation von Basis-Paketen...
[3/10] Installation von Node.js 20...
[4/10] Installation von Python 3.11 und venv...
[5/10] Installation von MongoDB 7.0...
[6/10] Erstelle App-Verzeichnis und Setup...
[7/10] Setup Python Backend...
[8/10] Setup React Frontend...
[9/10] Erstelle Systemd Services...
[10/10] Starte Services...
[SSL] Setup SSL-Zertifikat...
```

### Schritt 6: Installation prüfen

**Nach erfolgreicher Installation:**

```bash
# Backend-Service prüfen
sudo systemctl status employee-notes-backend
# Sollte: "active (running)" zeigen

# Nginx prüfen
sudo systemctl status nginx
# Sollte: "active (running)" zeigen

# MongoDB prüfen
sudo systemctl status mongod
# Sollte: "active (running)" zeigen

# Backend-Logs ansehen
sudo journalctl -u employee-notes-backend -n 20
# Sollte: "Application startup complete" zeigen
```

### Schritt 7: Im Browser testen

Öffnen Sie: `https://ihre-domain.de`

**Login-Seite sollte erscheinen:**
- Email: `admin@admin.de`
- Passwort: `admin2024`

**Nach Login:**
- Admin Dashboard sollte sichtbar sein
- "Test Firma GmbH" sollte angezeigt werden

---

## Troubleshooting während Installation

### Problem: "Permission denied"
```bash
# Lösung: Als root ausführen
sudo ./deploy.sh
```

### Problem: "backend/ not found"
```bash
# Prüfen ob im richtigen Verzeichnis
pwd
ls -la

# Sollte backend/ und frontend/ Ordner enthalten
# Falls nicht, Paket erneut entpacken
```

### Problem: "MongoDB installation failed"
```bash
# Manuell installieren
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
```

### Problem: "Backend startet nicht"
```bash
# Logs prüfen
sudo journalctl -u employee-notes-backend -n 50

# Häufige Ursachen:
# 1. Port 8001 bereits belegt
sudo netstat -tulpn | grep 8001

# 2. Python-Fehler
cd /opt/employee-notes
source venv/bin/activate
cd backend
python3 -c "import server"
```

### Problem: "Nginx 502 Bad Gateway"
```bash
# Backend läuft?
sudo systemctl status employee-notes-backend

# Backend neu starten
sudo systemctl restart employee-notes-backend

# Nginx neu starten
sudo systemctl restart nginx
```

### Problem: "SSL-Zertifikat Fehler"
```bash
# Prüfen ob Domain auf Server zeigt
nslookup ihre-domain.de

# Manuell SSL einrichten
sudo certbot --nginx -d ihre-domain.de --email ihre@email.de

# Certbot Logs bei Fehler
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## Post-Installation Tests

### Test 1: Backend API direkt testen
```bash
# Von Server aus
curl http://localhost:8001/api/

# Sollte zurückgeben: {"message":"Hello World"}
```

### Test 2: Login testen
```bash
curl -X POST https://ihre-domain.de/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.de","password":"admin2024"}'

# Sollte JWT Token zurückgeben
```

### Test 3: Nginx Konfiguration testen
```bash
sudo nginx -t

# Sollte: "syntax is ok" und "test is successful" zeigen
```

### Test 4: Logs auf Fehler prüfen
```bash
# Backend
sudo journalctl -u employee-notes-backend -n 50 --no-pager

# Nginx
sudo tail -n 50 /var/log/nginx/error.log

# MongoDB
sudo journalctl -u mongod -n 50 --no-pager
```

---

## Nach erfolgreicher Installation

### 1. Passwort ändern
- Im Browser einloggen: `admin@admin.de` / `admin2024`
- **WICHTIG:** Passwort sofort ändern!

### 2. Erste Firma erstellen
- Als Admin einloggen
- "Neue Firma" Button klicken
- Firmenname eingeben

### 3. Benutzer hinzufügen
- Registrieren-Link verwenden
- Firmen-ID eingeben (von Admin Dashboard)
- Email und Passwort eingeben

### 4. Backup einrichten
```bash
# Backup-Skript erstellen
sudo nano /root/backup-app.sh
```

Inhalt:
```bash
#!/bin/bash
BACKUP_DIR="/backup/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# MongoDB Backup
mongodump --db employee_notes_production --out $BACKUP_DIR/mongodb

# App-Dateien
tar -czf $BACKUP_DIR/app.tar.gz /opt/employee-notes

echo "Backup completed: $BACKUP_DIR"
```

Ausführbar machen und testen:
```bash
chmod +x /root/backup-app.sh
/root/backup-app.sh
```

### 5. Monitoring einrichten (Optional)
```bash
# Uptime-Monitoring
docker run -d --restart=always \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  --name uptime-kuma \
  louislam/uptime-kuma:1
```

Zugriff: `http://ihr-server:3001`

---

## Deinstallation (falls nötig)

```bash
# Services stoppen
sudo systemctl stop employee-notes-backend
sudo systemctl stop nginx
sudo systemctl stop mongod

# Services deaktivieren
sudo systemctl disable employee-notes-backend
sudo systemctl disable nginx
sudo systemctl disable mongod

# Service-Dateien entfernen
sudo rm /etc/systemd/system/employee-notes-backend.service
sudo systemctl daemon-reload

# App-Verzeichnis entfernen
sudo rm -rf /opt/employee-notes

# Nginx-Konfiguration entfernen
sudo rm /etc/nginx/sites-enabled/employee-notes
sudo rm /etc/nginx/sites-available/employee-notes

# Datenbank entfernen (VORSICHT!)
sudo rm -rf /var/lib/mongodb
```

---

## Checkliste für erfolgreiche Installation

- [ ] Ubuntu 24.04 Server vorhanden
- [ ] Domain zeigt auf Server-IP
- [ ] Paket heruntergeladen und entpackt
- [ ] deploy.sh ausgeführt
- [ ] Alle Services laufen (Backend, Nginx, MongoDB)
- [ ] HTTPS funktioniert (SSL-Zertifikat)
- [ ] Login funktioniert (admin@admin.de)
- [ ] Admin Dashboard sichtbar
- [ ] Passwort geändert
- [ ] Backup eingerichtet

**Bei Problemen:** Siehe DEPLOYMENT.md für detaillierte Troubleshooting-Anleitungen.

---

**Viel Erfolg mit Ihrer Installation! 🚀**
