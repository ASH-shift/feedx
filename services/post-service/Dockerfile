FROM node:20-alpine AS builder
WORKDIR /app

COPY services/post-service/package*.json ./
RUN npm install

COPY services/post-service/tsconfig.json ./
COPY services/post-service/src ./src

RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY services/post-service/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY proto /proto

EXPOSE 50052

CMD ["node", "dist/server.js"]
