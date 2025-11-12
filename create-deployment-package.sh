#!/bin/bash
#
# Erstellt ein Deployment-Paket zum Download
#

echo "📦 Erstelle Deployment-Paket..."

PACKAGE_NAME="employee-notes-app-$(date +%Y%m%d-%H%M%S)"
TEMP_DIR="/tmp/$PACKAGE_NAME"

# Erstelle temporäres Verzeichnis
mkdir -p $TEMP_DIR

# Kopiere notwendige Dateien
echo "Kopiere Backend-Dateien..."
mkdir -p $TEMP_DIR/backend
cp /app/backend/server.py $TEMP_DIR/backend/
cp /app/backend/requirements.txt $TEMP_DIR/backend/
cat > $TEMP_DIR/backend/.env.example <<EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=employee_notes_production
CORS_ORIGINS=http://ihre-domain.de,https://ihre-domain.de
JWT_SECRET_KEY=GENERIEREN_SIE_EINEN_SICHEREN_KEY
EOF

echo "Kopiere Frontend-Dateien..."
mkdir -p $TEMP_DIR/frontend/src
mkdir -p $TEMP_DIR/frontend/public

# Frontend Source
cp -r /app/frontend/src/* $TEMP_DIR/frontend/src/
cp -r /app/frontend/public/* $TEMP_DIR/frontend/public/
cp /app/frontend/package.json $TEMP_DIR/frontend/
cp /app/frontend/tailwind.config.js $TEMP_DIR/frontend/
cp /app/frontend/postcss.config.js $TEMP_DIR/frontend/

# Kopiere craco.config.js
cp /app/frontend/craco.config.js $TEMP_DIR/frontend/

# Frontend .env.example
cat > $TEMP_DIR/frontend/.env.example <<EOF
REACT_APP_BACKEND_URL=https://ihre-domain.de
EOF

echo "Kopiere Dokumentation..."
cp /app/README.md $TEMP_DIR/
cp /app/DEPLOYMENT.md $TEMP_DIR/
cp /app/SCHNELLSTART.md $TEMP_DIR/
cp /app/deploy.sh $TEMP_DIR/

echo "Erstelle Installations-Anleitung..."
cat > $TEMP_DIR/INSTALLATION.txt <<EOF
╔═══════════════════════════════════════════════════════╗
║   Mitarbeiter-Notizen-App - Installation             ║
╚═══════════════════════════════════════════════════════╝

SCHNELLSTART:
===========

1. Paket auf Ihren Ubuntu 24.04-Server hochladen:
   scp -r $PACKAGE_NAME root@ihr-server:/root/

2. Auf dem Server:
   cd /root/$PACKAGE_NAME
   chmod +x deploy.sh
   sudo ./deploy.sh

3. Anweisungen folgen und fertig!

INHALT:
=======
• backend/          - FastAPI Backend
• frontend/         - React Frontend
• deploy.sh         - Automatisches Deployment-Skript
• README.md         - App-Dokumentation
• DEPLOYMENT.md     - Detaillierte Deployment-Anleitung
• SCHNELLSTART.md   - 5-Minuten Schnellstart
• INSTALLATION.txt  - Diese Datei

VORAUSSETZUNGEN:
===============
• Ubuntu 24.04 Server
• Domain zeigt auf Server-IP
• Root oder sudo-Zugriff
• Mindestens 2 GB RAM

SUPPORT:
========
Siehe DEPLOYMENT.md für Troubleshooting und weitere Hilfe.

Viel Erfolg! 🚀
EOF

# Erstelle Archiv
cd /tmp
echo "Erstelle Archiv..."
tar -czf ${PACKAGE_NAME}.tar.gz $PACKAGE_NAME

# Verschiebe zu /app
mv ${PACKAGE_NAME}.tar.gz /app/

# Cleanup
rm -rf $TEMP_DIR

echo ""
echo "✅ Deployment-Paket erstellt!"
echo ""
echo "📦 Paket: /app/${PACKAGE_NAME}.tar.gz"
echo ""
echo "Download-Befehle:"
echo "================"
echo ""
echo "Von Ihrem lokalen Rechner:"
echo "  scp root@ihr-emergent-server:/app/${PACKAGE_NAME}.tar.gz ."
echo ""
echo "Dann auf Ihrem Ubuntu-Server:"
echo "  scp ${PACKAGE_NAME}.tar.gz root@ihr-ubuntu-server:/root/"
echo "  ssh root@ihr-ubuntu-server"
echo "  cd /root"
echo "  tar -xzf ${PACKAGE_NAME}.tar.gz"
echo "  cd $PACKAGE_NAME"
echo "  chmod +x deploy.sh"
echo "  sudo ./deploy.sh"
echo ""
