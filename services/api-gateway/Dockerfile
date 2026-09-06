FROM node:20-alpine AS builder
WORKDIR /app

COPY services/api-gateway/package*.json ./
RUN npm install

COPY services/api-gateway/tsconfig.json ./
COPY services/api-gateway/src ./src

RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY services/api-gateway/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY proto /proto

EXPOSE 3000

CMD ["node", "dist/server.js"]
