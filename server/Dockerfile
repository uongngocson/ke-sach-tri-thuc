FROM node:24-alpine

WORKDIR /app

COPY . .

RUN npm install --production --no-audit --no-fund --prefer-offline || true

EXPOSE 5000

CMD ["sh", "-c", "node scripts/migrate.js && node server.js"]
