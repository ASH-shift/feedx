FROM node:20-alpine AS builder
WORKDIR /app

COPY services/notification-service/package*.json ./
RUN npm install

COPY services/notification-service/tsconfig.json ./
COPY services/notification-service/src ./src

RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY services/notification-service/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY proto /proto

EXPOSE 3001

CMD ["node", "dist/server.js"]
