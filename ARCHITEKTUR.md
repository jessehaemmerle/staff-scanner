# 🏗️ System-Architektur - Mitarbeiter-Notizen-App

## Deployment-Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet / Benutzer                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTPS (Port 443)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       Nginx Reverse Proxy                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • SSL-Terminierung (Let's Encrypt)                  │   │
│  │  • Static File Serving (React Build)                 │   │
│  │  • API Proxy (/api/* → Backend:8001)                 │   │
│  │  • Gzip Compression                                  │   │
│  │  • Rate Limiting                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────┬─────────────────────────────────┬──────────────┘
             │                                 │
             │ Static Files                    │ /api/* Requests
             ▼                                 ▼
   ┌──────────────────┐           ┌─────────────────────────┐
   │  React Frontend  │           │   FastAPI Backend       │
   │  (Build Folder)  │           │   (Port 8001)           │
   │                  │           │                         │
   │  • HTML/CSS/JS   │           │  • REST API Endpoints   │
   │  • SPA Routing   │           │  • JWT Authentication   │
   │  • Barcode UI    │           │  • Business Logic       │
   └──────────────────┘           │  • Data Validation      │
                                  └────────────┬────────────┘
                                               │
                                               │ MongoDB Driver
                                               ▼
                                  ┌─────────────────────────┐
                                  │   MongoDB Database      │
                                  │   (Port 27017)          │
                                  │                         │
                                  │  Collections:           │
                                  │  • companies            │
                                  │  • users                │
                                  │  • employees            │
                                  │  • notes                │
                                  └─────────────────────────┘
```

## Systemd Services

```
┌─────────────────────────────────────────────────────────────┐
│                        Systemd                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  employee-notes-backend.service                       │  │
│  │  ├─ ExecStart: uvicorn server:app                     │  │
│  │  ├─ WorkingDirectory: /opt/employee-notes/backend     │  │
│  │  ├─ Restart: always                                   │  │
│  │  └─ After: mongod.service                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  nginx.service                                        │  │
│  │  ├─ Serves: Frontend Static Files                     │  │
│  │  ├─ Proxies: /api/* → localhost:8001                  │  │
│  │  └─ SSL: Certbot managed                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  mongod.service                                       │  │
│  │  ├─ Database: employee_notes_production               │  │
│  │  ├─ Port: 27017 (localhost only)                      │  │
│  │  └─ Data: /var/lib/mongodb                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Datenfluss

### 1. Benutzer-Login
```
Browser → Nginx → React SPA
       ↓
Browser sendet POST /api/auth/login
       ↓
Nginx proxy → FastAPI Backend
       ↓
Backend validiert → MongoDB (users collection)
       ↓
JWT Token generiert
       ↓
Token zurück an Browser → LocalStorage
```

### 2. Barcode scannen & Mitarbeiter erstellen
```
Browser → React (html5-qrcode)
       ↓
Barcode gescannt (z.B. "EMP12345")
       ↓
POST /api/employees/number/EMP12345 mit JWT
       ↓
Nginx → Backend → MongoDB (employees collection)
       ↓
Wenn nicht gefunden:
  - User gibt Namen ein
  - POST /api/employees {number, name}
  - MongoDB speichert Mitarbeiter
       ↓
Mitarbeiter-Daten zurück an Frontend
```

### 3. Notiz erstellen
```
Browser → React (Notiz-Dialog)
       ↓
POST /api/notes {employee_id, note_text} mit JWT
       ↓
Nginx → Backend
       ↓
Backend validiert:
  - JWT Token
  - Employee gehört zu User's Company
  - Timestamp wird generiert
       ↓
MongoDB (notes collection) speichert
       ↓
Erfolg zurück an Frontend
       ↓
Frontend aktualisiert Liste
```

### 4. CSV Export
```
Browser → GET /api/notes/export/csv mit JWT
       ↓
Nginx → Backend
       ↓
Backend:
  - Lädt alle Notizen der Company
  - Joined mit Employee-Daten
  - Generiert CSV in-memory
       ↓
StreamingResponse zurück
       ↓
Browser lädt CSV-Datei herunter
```

## Sicherheitsarchitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Network                                            │
│  ├─ UFW Firewall (nur 80, 443, 22)                          │
│  └─ MongoDB nur localhost (127.0.0.1:27017)                 │
│                                                              │
│  Layer 2: Transport                                          │
│  ├─ SSL/TLS (Let's Encrypt)                                 │
│  ├─ HTTPS erzwungen                                          │
│  └─ Secure Headers (Nginx)                                   │
│                                                              │
│  Layer 3: Application                                        │
│  ├─ JWT Authentication                                       │
│  ├─ Token Expiration (7 Tage)                               │
│  ├─ Bcrypt Password Hashing                                 │
│  └─ CORS konfiguriert                                        │
│                                                              │
│  Layer 4: Data Access                                        │
│  ├─ Role-Based Access Control (Admin/User)                  │
│  ├─ Company-Based Data Isolation                            │
│  ├─ Input Validation (Pydantic)                             │
│  └─ SQL Injection geschützt (MongoDB)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Verzeichnisstruktur auf dem Server

```
/opt/employee-notes/
├── backend/
│   ├── server.py              # FastAPI App
│   ├── requirements.txt       # Python Dependencies
│   └── .env                   # Backend Config
│
├── frontend/
│   ├── build/                 # Production Build (von Nginx serviert)
│   │   ├── index.html
│   │   ├── static/
│   │   │   ├── css/
│   │   │   └── js/
│   │   └── asset-manifest.json
│   │
│   ├── src/                   # Source (nicht deployed)
│   ├── package.json
│   └── .env                   # Frontend Config
│
└── venv/                      # Python Virtual Environment
    └── bin/
        └── uvicorn

/var/lib/mongodb/              # MongoDB Daten
├── collection-*.wt
└── WiredTiger*

/etc/systemd/system/
└── employee-notes-backend.service

/etc/nginx/
├── sites-available/
│   └── employee-notes
└── sites-enabled/
    └── employee-notes → ../sites-available/employee-notes

/var/log/
├── nginx/
│   ├── access.log
│   └── error.log
└── journal/                   # Systemd logs
    └── (journalctl -u employee-notes-backend)
```

## Performance-Überlegungen

### Frontend
- **Build-Optimierung**: Production build mit Minification
- **Code Splitting**: React lazy loading für Routes
- **Asset Caching**: Nginx cacht statische Dateien (1 Jahr)
- **Gzip Compression**: Nginx komprimiert alle Responses

### Backend
- **Async I/O**: FastAPI mit Motor (async MongoDB)
- **Connection Pooling**: MongoDB Connection Pool
- **Pydantic Validation**: Schnelle Datenvalidierung
- **uvicorn Workers**: Multi-Worker setup möglich

### Database
- **Indexes**: Empfohlen auf:
  - users.email (unique)
  - employees.employee_number + company_id
  - notes.employee_id
  - notes.timestamp

### Skalierung
```
Aktuelle Konfiguration (Single Server):
├─ Geeignet für: 1-1000 gleichzeitige Benutzer
├─ Storage: ~100MB pro 10.000 Notizen
└─ RAM: 2GB ausreichend

Bei höherer Last:
├─ Backend: Multiple uvicorn workers
├─ Database: MongoDB Replica Set
├─ Cache: Redis für Sessions
├─ Load Balancer: Nginx + mehrere Backend-Instanzen
└─ CDN: Für statische Assets
```

## Monitoring & Logging

```
┌─────────────────────────────────────────────────────────────┐
│                    Logging & Monitoring                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  systemd journal                                             │
│  ├─ Backend: journalctl -u employee-notes-backend           │
│  └─ MongoDB: journalctl -u mongod                           │
│                                                              │
│  Nginx Logs                                                  │
│  ├─ Access: /var/log/nginx/access.log                      │
│  └─ Error: /var/log/nginx/error.log                        │
│                                                              │
│  Optional: Monitoring Tools                                  │
│  ├─ Uptime Kuma (Status monitoring)                         │
│  ├─ Prometheus + Grafana (Metrics)                          │
│  └─ Sentry (Error tracking)                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Backup-Strategie

```
Tägliches Backup:
├─ MongoDB: mongodump --db employee_notes_production
├─ App-Code: tar -czf /backup/app.tar.gz /opt/employee-notes
└─ Nginx Config: cp /etc/nginx/sites-available/employee-notes /backup/

Aufbewahrung:
├─ Täglich: 7 Tage
├─ Wöchentlich: 4 Wochen
└─ Monatlich: 12 Monate

Wiederherstellung:
mongorestore --db employee_notes_production /backup/dump/
```

---

**Diese Architektur ist produktionsbereit und skalierbar! 🚀**
