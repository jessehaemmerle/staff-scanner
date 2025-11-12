# ⚡ Schnellstart - Deployment in 5 Minuten

## Voraussetzungen
- ✅ Ubuntu 24.04 Server
- ✅ Domain (z.B. notes.ihrefirma.de) zeigt auf Server-IP
- ✅ Root/sudo-Zugriff

## Installation

### 1️⃣ Dateien auf Server hochladen
```bash
# Von Ihrem lokalen Rechner:
scp -r /pfad/zur/app root@ihr-server:/root/employee-notes-app
```

### 2️⃣ Deployment-Skript ausführen
```bash
# Auf dem Server:
cd /root/employee-notes-app
chmod +x deploy.sh
sudo ./deploy.sh
```

### 3️⃣ Anweisungen folgen
- Domain eingeben: `notes.ihrefirma.de`
- Email eingeben: `ihre@email.de`
- Bestätigen: `j`
- Warten Sie ~10 Minuten

### 4️⃣ Fertig! 🎉
```
https://ihre-domain.de
```

**Login:**
- Email: `admin@admin.de`
- Passwort: `admin2024`

⚠️ **Wichtig:** Passwort sofort ändern!

---

## Was macht das Skript?
1. Installiert Node.js, Python, MongoDB
2. Konfiguriert Backend & Frontend
3. Erstellt systemd Service
4. Konfiguriert Nginx
5. Installiert SSL-Zertifikat
6. Erstellt Admin-User
7. Startet alle Services

---

## Wichtige Befehle

### Logs anzeigen
```bash
sudo journalctl -u employee-notes-backend -f
```

### Service neu starten
```bash
sudo systemctl restart employee-notes-backend
```

### Service-Status
```bash
sudo systemctl status employee-notes-backend
```

---

## Probleme?

### Backend läuft nicht?
```bash
sudo journalctl -u employee-notes-backend -n 50
```

### Frontend zeigt Fehler?
```bash
sudo systemctl restart nginx
sudo nginx -t
```

### MongoDB Problem?
```bash
sudo systemctl status mongod
sudo systemctl restart mongod
```

---

## App-Verzeichnis
```
/opt/employee-notes/
├── backend/       # FastAPI Backend
├── frontend/      # React Frontend (gebaut)
└── venv/          # Python Virtual Environment
```

---

## Weitere Hilfe
Siehe `DEPLOYMENT.md` für detaillierte Anleitung.
