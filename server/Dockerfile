FROM node:20-alpine

WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache curl python3 make g++

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["sh", "-c", "node scripts/migrate.js && node server.js"]
