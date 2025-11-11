# Mitarbeiter-Notizen-App

Eine Mobile-First Webanwendung zur Erfassung und Verwaltung von Mitarbeiternotizen mit Barcode-Scanner-Funktionalität.

## Features

### Admin-Funktionen
- ✅ Firmen erstellen und verwalten
- ✅ Übersicht aller Firmen
- ✅ Sicherer Login mit JWT

### Benutzer-Funktionen
- ✅ Barcode-Scanner für Mitarbeiterausweise
- ✅ Mitarbeiter erfassen (Nummer + Name)
- ✅ Notizen zu Mitarbeitern hinzufügen (mit Timestamp)
- ✅ Notizen-Historie anzeigen
- ✅ CSV-Export aller Notizen
- ✅ Mobile-First Design

## Tech Stack

### Backend
- FastAPI (Python)
- MongoDB (mit Motor async driver)
- JWT Authentication (python-jose)
- Passlib (bcrypt für Passwort-Hashing)

### Frontend
- React 19
- Shadcn/UI Components
- TailwindCSS
- html5-qrcode (Barcode-Scanner)
- Axios für API-Calls

## Test-Zugangsdaten

### Admin-Zugang
- **Email:** admin@test.de
- **Passwort:** admin123
- **Funktion:** Firmen erstellen und verwalten

### Benutzer-Zugang
- **Email:** user@test.de
- **Passwort:** user123
- **Funktion:** Mitarbeiter scannen, Notizen erstellen

### Test-Firma
- **ID:** 1db3044e-8fc2-4149-be78-ef50454bf8a2
- **Name:** Test Firma GmbH

## API Endpunkte

### Authentifizierung
- `POST /api/auth/register` - Neuen Benutzer registrieren
- `POST /api/auth/login` - Anmelden
- `GET /api/auth/me` - Aktuellen Benutzer abrufen

### Firmen (nur Admin)
- `POST /api/companies` - Neue Firma erstellen
- `GET /api/companies` - Alle Firmen abrufen
- `GET /api/companies/{id}` - Firma nach ID

### Mitarbeiter
- `POST /api/employees` - Neuen Mitarbeiter erstellen
- `GET /api/employees` - Alle Mitarbeiter der Firma
- `GET /api/employees/{id}` - Mitarbeiter nach ID
- `GET /api/employees/number/{number}` - Mitarbeiter nach Barcode-Nummer

### Notizen
- `POST /api/notes` - Neue Notiz erstellen
- `GET /api/notes` - Alle Notizen der Firma
- `GET /api/notes/employee/{id}` - Notizen eines Mitarbeiters
- `GET /api/notes/export/csv` - CSV-Export

## Workflow

1. **Admin:** Erstellt Firma über Admin Dashboard
2. **Benutzer:** Registriert sich mit Firmen-ID
3. **Benutzer:** Scannt Mitarbeiterausweis mit Barcode-Scanner
4. **Benutzer:** Erfasst Namen des Mitarbeiters (bei Ersterfassung)
5. **Benutzer:** Fügt Notiz zum Mitarbeiter hinzu
6. **Benutzer:** Kann jederzeit Notizen abrufen und als CSV exportieren

## Mobile-First Design

Die App ist optimiert für:
- Smartphones (ab 375px)
- Tablets (ab 768px)
- Desktop (ab 1024px)

Alle Funktionen sind touch-optimiert und auf mobilen Geräten voll nutzbar.

## CSV-Export Format

```csv
Mitarbeiternummer,Name,Notiz,Timestamp,Erstellt am
EMP123,Max Mustermann,Notiz-Text,2025-11-11T17:30:00,2025-11-11T17:30:00
```

---

**Entwickelt mit Emergent Labs** 🚀
