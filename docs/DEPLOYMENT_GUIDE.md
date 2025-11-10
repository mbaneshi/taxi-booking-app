# Deployment Guide

## Table of Contents
1. [Backend Deployment](#backend-deployment)
2. [Database Setup](#database-setup)
3. [Mobile App Deployment](#mobile-app-deployment)
4. [Admin Dashboard Deployment](#admin-dashboard-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

- Node.js v18+ installed
- PostgreSQL 14+ with PostGIS extension
- Redis server
- AWS/GCP/Azure account (for cloud deployment)
- Stripe account
- Google Cloud Platform account (for Maps API)
- Apple Developer account ($99/year)
- Google Play Developer account ($25 one-time)
- Domain name and SSL certificate

---

## Backend Deployment

### Option 1: Deploy to AWS EC2

#### 1. Launch EC2 Instance

```bash
# Choose Ubuntu Server 22.04 LTS
# Instance type: t3.medium or better
# Configure security group:
# - Allow SSH (port 22) from your IP
# - Allow HTTP (port 80) from anywhere
# - Allow HTTPS (port 443) from anywhere
# - Allow custom TCP (port 3000) from anywhere
```

#### 2. Connect to Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

#### 3. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib postgis

# Install Redis
sudo apt install -y redis-server

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

#### 4. Setup PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE taxi_booking;
CREATE USER taxi_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE taxi_booking TO taxi_user;

# Enable PostGIS
\c taxi_booking
CREATE EXTENSION postgis;

\q
```

#### 5. Clone and Setup Application

```bash
# Clone repository
cd /var/www
sudo git clone your-repo-url taxi-backend
cd taxi-backend

# Install dependencies
npm install --production

# Create .env file
sudo nano .env
# Copy content from .env.example and update values
```

#### 6. Run Database Migrations

```bash
npm run migrate
```

#### 7. Start Application with PM2

```bash
pm2 start src/server.js --name taxi-backend
pm2 save
pm2 startup
```

#### 8. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/taxi-backend
```

Add configuration:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/taxi-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 9. Setup SSL Certificate

```bash
sudo certbot --nginx -d api.yourdomain.com
```

#### 10. Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### Option 2: Deploy to Heroku

#### 1. Install Heroku CLI

```bash
npm install -g heroku
```

#### 2. Login and Create App

```bash
heroku login
heroku create taxi-booking-backend
```

#### 3. Add PostgreSQL and Redis

```bash
heroku addons:create heroku-postgresql:mini
heroku addons:create heroku-redis:mini
```

#### 4. Configure Environment Variables

```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret_here
# ... set all other environment variables
```

#### 5. Deploy

```bash
git push heroku main
```

#### 6. Run Migrations

```bash
heroku run npm run migrate
```

### Option 3: Deploy with Docker

#### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgis/postgis:14-3.3
    environment:
      POSTGRES_DB: taxi_booking
      POSTGRES_USER: taxi_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 3. Build and Run

```bash
docker-compose up -d
```

---

## Database Setup

### PostgreSQL with PostGIS

#### 1. Installation

```bash
# Ubuntu/Debian
sudo apt install postgresql-14 postgresql-14-postgis-3

# macOS
brew install postgresql postgis

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### 2. Create Database

```sql
CREATE DATABASE taxi_booking;
\c taxi_booking
CREATE EXTENSION postgis;
```

#### 3. Run Migrations

```bash
cd backend
npm run migrate
```

#### 4. Backup and Restore

Backup:
```bash
pg_dump -U taxi_user taxi_booking > backup.sql
```

Restore:
```bash
psql -U taxi_user taxi_booking < backup.sql
```

#### 5. Automated Backups

Create backup script:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/postgres"
mkdir -p $BACKUP_DIR

pg_dump -U taxi_user taxi_booking | gzip > $BACKUP_DIR/taxi_backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "taxi_backup_*.sql.gz" -mtime +30 -delete
```

Add to crontab:
```bash
crontab -e
# Add: 0 2 * * * /path/to/backup-script.sh
```

---

## Mobile App Deployment

### iOS Deployment

#### 1. Prerequisites

- Mac computer with Xcode
- Apple Developer account ($99/year)
- App Store Connect access

#### 2. Configure App

```bash
cd apps/passenger
# or cd apps/driver

# Update app.json
{
  "expo": {
    "name": "Taxi Passenger App",
    "slug": "taxi-passenger",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.yourdomain.taxipassenger",
      "buildNumber": "1.0.0",
      "supportsTablet": true
    }
  }
}
```

#### 3. Build for iOS

```bash
# Using Expo
expo build:ios

# Or using EAS Build
eas build --platform ios
```

#### 4. Submit to App Store

1. Create app in App Store Connect
2. Fill in app information, screenshots, description
3. Upload build using Xcode or Transporter
4. Submit for review

**App Store Requirements:**
- App icon (1024x1024)
- Screenshots for all required device sizes
- Privacy policy URL
- Support URL
- App description (4000 characters)
- Keywords (100 characters)
- Age rating
- App category

### Android Deployment

#### 1. Generate Signing Key

```bash
keytool -genkey -v -keystore taxi-passenger.keystore -alias taxi-passenger-key -keyalg RSA -keysize 2048 -validity 10000
```

#### 2. Configure Build

Update `app.json`:
```json
{
  "expo": {
    "android": {
      "package": "com.yourdomain.taxipassenger",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      }
    }
  }
}
```

#### 3. Build for Android

```bash
# Using Expo
expo build:android

# Or using EAS Build
eas build --platform android
```

#### 4. Submit to Google Play

1. Create app in Google Play Console
2. Complete store listing
3. Upload APK/AAB
4. Complete content rating questionnaire
5. Set pricing and distribution
6. Submit for review

**Google Play Requirements:**
- App icon (512x512)
- Feature graphic (1024x500)
- Screenshots (at least 2 per device type)
- Short description (80 characters)
- Full description (4000 characters)
- Privacy policy URL
- Content rating
- App category

---

## Admin Dashboard Deployment

### Option 1: Deploy to Netlify

#### 1. Build Production Version

```bash
cd admin
npm run build
```

#### 2. Deploy with Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

#### 3. Configure Environment Variables

In Netlify dashboard:
- Site settings → Build & deploy → Environment
- Add: `REACT_APP_API_URL=https://api.yourdomain.com`

### Option 2: Deploy to Vercel

```bash
npm install -g vercel
cd admin
vercel --prod
```

### Option 3: Deploy to AWS S3 + CloudFront

#### 1. Build

```bash
cd admin
npm run build
```

#### 2. Create S3 Bucket

```bash
aws s3 mb s3://taxi-admin-dashboard
aws s3 sync build/ s3://taxi-admin-dashboard
```

#### 3. Configure CloudFront

- Create CloudFront distribution
- Point origin to S3 bucket
- Configure SSL certificate
- Set index.html as default root object

---

## Environment Configuration

### Backend .env

```bash
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=taxi_booking
DB_USER=taxi_user
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=your-very-secure-secret-key-here
JWT_EXPIRY=7d
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRY=30d

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-key

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# App Config
BASE_FARE=3.50
PER_KM_RATE=1.50
PER_MINUTE_RATE=0.30
COMMISSION_RATE=0.20

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

### Mobile Apps

Update API URL in `src/services/api.js`:
```javascript
const API_BASE_URL = 'https://api.yourdomain.com/api';
```

Update Stripe publishable key in `App.js`:
```javascript
<StripeProvider publishableKey="pk_live_...">
```

---

## Monitoring & Maintenance

### Application Monitoring

#### 1. PM2 Monitoring

```bash
pm2 monit
pm2 logs taxi-backend
pm2 restart taxi-backend
```

#### 2. Nginx Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

#### 3. Database Monitoring

```sql
-- Check active connections
SELECT * FROM pg_stat_activity;

-- Check database size
SELECT pg_size_pretty(pg_database_size('taxi_booking'));

-- Check slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

### Health Checks

Setup monitoring service (UptimeRobot, Pingdom, etc.) to check:
- API health endpoint: `https://api.yourdomain.com/health`
- Response time < 500ms
- Uptime > 99.5%

### Backup Strategy

1. **Database backups**: Daily automated backups, keep 30 days
2. **Application backups**: Git repository
3. **Media files**: S3 or cloud storage with versioning

### Security Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js packages
npm audit
npm audit fix

# Update PM2
pm2 update
```

### Performance Optimization

1. **Enable Redis caching**
2. **Database query optimization**
3. **CDN for static assets**
4. **Image optimization**
5. **Gzip compression**
6. **HTTP/2 enablement**

### Scaling

#### Horizontal Scaling

```bash
# Add more backend instances
pm2 scale taxi-backend +2

# Use load balancer (Nginx, HAProxy, AWS ELB)
```

#### Database Scaling

- Read replicas for read-heavy operations
- Connection pooling
- Query optimization
- Indexing

---

## Troubleshooting

### Common Issues

**Issue: Database connection fails**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -U taxi_user -d taxi_booking -h localhost
```

**Issue: Redis connection fails**
```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping
```

**Issue: High memory usage**
```bash
# Check PM2 processes
pm2 list
pm2 monit

# Restart application
pm2 restart taxi-backend
```

**Issue: WebSocket not connecting**
- Check firewall rules
- Verify Nginx WebSocket configuration
- Check CORS settings

---

## Rollback Procedure

### Application Rollback

```bash
# PM2 rollback
pm2 reload taxi-backend --update-env

# Git rollback
git revert HEAD
git push origin main
pm2 restart taxi-backend
```

### Database Rollback

```bash
# Restore from backup
psql -U taxi_user taxi_booking < backup.sql
```

---

## Support & Maintenance

### Recommended Maintenance Schedule

- **Daily**: Check logs, monitor errors
- **Weekly**: Review performance metrics, backup verification
- **Monthly**: Security updates, dependency updates
- **Quarterly**: Database optimization, capacity planning

### Emergency Contacts

- Server Issues: DevOps team
- Database Issues: Database admin
- Payment Issues: Stripe support
- Maps Issues: Google Maps support

---

## Appendix

### Useful Commands

```bash
# PM2
pm2 start/stop/restart <app>
pm2 logs <app>
pm2 monit
pm2 save
pm2 startup

# Nginx
sudo nginx -t
sudo systemctl restart nginx
sudo tail -f /var/log/nginx/error.log

# PostgreSQL
sudo -u postgres psql
\l - list databases
\c database - connect to database
\dt - list tables

# Redis
redis-cli
PING
INFO
KEYS *
```
