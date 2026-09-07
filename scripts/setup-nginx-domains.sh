#!/bin/bash
# =========================================================================
# FOXREAD - NGINX DOMAIN SETUP SCRIPT
# Doi domain: caosach.soninfra.cloud -> foxread.soninfra.cloud
#             stagcaosach.soninfra.cloud -> stagfoxread.soninfra.cloud
#
# Chay tren server: bash /home/sonun/ke-sach-tri-thuc/scripts/setup-nginx-domains.sh
# =========================================================================
set -e

echo "🦊 [FoxRead] Cau hinh Nginx voi domain moi..."
echo "   Production  : foxread.soninfra.cloud"
echo "   Staging     : stagfoxread.soninfra.cloud"
echo ""

# -- 1. Tao config production -----------------------------------------------
echo "📝 [1/6] Tao Nginx config production..."
sudo tee /etc/nginx/sites-available/foxread-prod.conf > /dev/null << 'NGINX_PROD'
server {
    listen 80;
    server_name foxread.soninfra.cloud;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name foxread.soninfra.cloud;

    ssl_certificate     /etc/letsencrypt/live/foxread.soninfra.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/foxread.soninfra.cloud/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:5505;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:5005;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass         http://127.0.0.1:5005;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
    }

    location /health {
        proxy_pass http://127.0.0.1:5005;
    }
}
NGINX_PROD

# -- 2. Tao config staging --------------------------------------------------
echo "📝 [2/6] Tao Nginx config staging..."
sudo tee /etc/nginx/sites-available/foxread-staging.conf > /dev/null << 'NGINX_STAGING'
server {
    listen 80;
    server_name stagfoxread.soninfra.cloud;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name stagfoxread.soninfra.cloud;

    ssl_certificate     /etc/letsencrypt/live/stagfoxread.soninfra.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stagfoxread.soninfra.cloud/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:5506;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:5006;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass         http://127.0.0.1:5006;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
    }

    location /health {
        proxy_pass http://127.0.0.1:5006;
    }
}
NGINX_STAGING

# -- 3. Enable sites --------------------------------------------------------
echo "🔗 [3/6] Enable Nginx sites..."
sudo ln -sf /etc/nginx/sites-available/foxread-prod.conf    /etc/nginx/sites-enabled/foxread-prod.conf
sudo ln -sf /etc/nginx/sites-available/foxread-staging.conf /etc/nginx/sites-enabled/foxread-staging.conf

# Disable old caosach configs
sudo rm -f /etc/nginx/sites-enabled/caosach*.conf
sudo rm -f /etc/nginx/sites-enabled/stagcaosach*.conf

# -- 4. Test Nginx truoc khi cap cert (port 80 can mo) ----------------------
echo "⚙️ [4/6] Test Nginx config..."
sudo nginx -t
sudo systemctl reload nginx

# -- 5. Cap SSL Certificate voi Let Encrypt ---------------------------------
echo "🔐 [5/6] Cap SSL certificates..."

if [ ! -d "/etc/letsencrypt/live/foxread.soninfra.cloud" ]; then
    echo "   -> Cap cert moi cho foxread.soninfra.cloud..."
    sudo certbot --nginx -d foxread.soninfra.cloud --non-interactive --agree-tos --email admin@soninfra.cloud --redirect
else
    echo "   ✅ Cert foxread.soninfra.cloud da ton tai."
fi

if [ ! -d "/etc/letsencrypt/live/stagfoxread.soninfra.cloud" ]; then
    echo "   -> Cap cert moi cho stagfoxread.soninfra.cloud..."
    sudo certbot --nginx -d stagfoxread.soninfra.cloud --non-interactive --agree-tos --email admin@soninfra.cloud --redirect
else
    echo "   ✅ Cert stagfoxread.soninfra.cloud da ton tai."
fi

# -- 6. Final reload --------------------------------------------------------
echo "🔄 [6/6] Final Nginx reload..."
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "========================================================"
echo "✅ NGINX DOMAIN UPDATE HOAN TAT!"
echo "   🌐 Production : https://foxread.soninfra.cloud"
echo "   🧪 Staging    : https://stagfoxread.soninfra.cloud"
echo "========================================================"
