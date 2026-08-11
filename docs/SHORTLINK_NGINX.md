# MediaVault nginx: shortlink /apl → Next.js (port 3000)

# Place these location blocks in the HTTPS server for cq.imim.chat
# BEFORE `location /` that proxies to MediaVault.
#
# After merging shortlinks into MediaVault:
# 1. Stop legacy PM2 process: pm2 stop audio-shortcuts && pm2 delete audio-shortcuts
# 2. Remove or disable /www/server/panel/vhost/nginx/audio_shortcuts.conf
# 3. Remove any prior /apl|/admin.html|/api/login|/api/users|/api/config
#    shortlink-specific locations that pointed at port 3005
# 4. Keep only the block below (MediaVault already handles /admin)

    location ^~ /apl/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
