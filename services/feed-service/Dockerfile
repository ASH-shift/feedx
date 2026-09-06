FROM node:20-alpine AS builder
WORKDIR /app

COPY services/feed-service/package*.json ./
RUN npm install

COPY services/feed-service/tsconfig.json ./
COPY services/feed-service/src ./src

RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY services/feed-service/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY proto /proto

EXPOSE 50053

CMD ["node", "dist/server.js"]
