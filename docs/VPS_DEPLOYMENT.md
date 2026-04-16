# VPS Deployment Guide (Byblos)

This guide outlines the steps to deploy Byblos on a standard Linux VPS (Ubuntu 22.04+ recommended).

## 1. Prerequisites
- Node.js (v18+)
- PostgreSQL (v15+)
- Redis
- Nginx
- PM2 (`npm install -g pm2`)
- Certbot (`snap install --classic certbot`)

## 2. Setting Up the Project
```bash
# Clone the repository
git clone <your-repo-url> /var/www/bybloshq
cd /var/www/bybloshq

# Install dependencies (Root/Frontend)
npm install
npm run build

# Install dependencies (Server)
cd server
npm install
```

## 3. Environment Variables
Create `.env` files in both the root and `server/` directories based on the project requirements.

## 4. Database Setup
```bash
# Run migrations from the server directory
cd /var/www/bybloshq/server
npm run migrate
```

## 5. Running with PM2
Create an `ecosystem.config.cjs` in the root:
```javascript
module.exports = {
  apps: [
    {
      name: 'byblos-backend',
      cwd: './server',
      script: 'src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```
Start the application:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 6. Nginx & SSL
Copy the `nginx/production.nginx.conf` and update the paths:
```bash
sudo cp nginx/production.nginx.conf /etc/nginx/sites-available/bybloshq
sudo ln -s /etc/nginx/sites-available/bybloshq /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install SSL
sudo certbot --nginx -d bybloshq.space -d www.bybloshq.space -d api.bybloshq.space
```

## 7. WhatsApp Service
The WhatsApp service runs as part of the `byblos-backend` process. It is non-blocking and will initialize automatically. Ensure the user running the process has write permissions to `server/baileys_auth_info/`.

## 8. Alternative: Deployment with Docker
If you prefer Docker, the project is already set up with a `docker-compose.yml`.

### Deployment Steps:
1. Ensure `docker` and `docker-compose` are installed.
2. Update the `.env` file in the root.
3. Build and start:
```bash
docker-compose up -d --build
```
This will start Postgres, Redis, the Backend, Frontend, and Nginx in orchestrated containers.

### Service Separation:
- **Backend**: Containerized and isolated.
- **Frontend**: Built and served via Nginx.
- **WhatsApp**: Runs inside the Backend container.
