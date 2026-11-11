FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
# devDependencies are kept so sequelize-cli can run migrations inside the container.
RUN npm ci

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5000/api/health/live || exit 1

CMD ["node", "src/server.js"]
