# FeedX — Distributed Real-Time Feed System

A production-grade, Twitter-like social feed built with a microservices architecture. Demonstrates event-driven design, fan-out on write, real-time WebSocket push, and horizontal scalability.

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![Kafka](https://img.shields.io/badge/Apache_Kafka-231F20?logo=apachekafka&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![gRPC](https://img.shields.io/badge/gRPC-Protobuf-244c5a?logo=google&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Next.js Frontend                           │
│                    (React 18, Zustand, Tailwind)                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST / HTTP
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API Gateway :3000                          │
│              (Express, JWT Auth Middleware, gRPC Clients)           │
└────────┬────────────────┬────────────────┬───────────────────────────┘
         │ gRPC           │ gRPC           │ gRPC
         ▼                ▼                ▼
 ┌───────────────┐ ┌──────────────┐ ┌────────────────┐
 │ user-service  │ │ post-service │ │  feed-service  │
 │    :50051     │ │   :50052     │ │    :50053      │
 │               │ │              │ │                │
 │  PostgreSQL   │ │  PostgreSQL  │ │  Redis Sorted  │
 │  (users DB)   │ │  (posts DB)  │ │     Sets       │
 └───────────────┘ └──────┬───────┘ └───────┬────────┘
                          │                 │
                          │ Kafka           │ gRPC (GetFollowers)
                          │ post.created    │
                          ▼                 │
                 ┌────────────────┐         │
                 │ notification-  │◄────────┘
                 │   service      │
                 │    :3001       │
                 │                │
                 │   WebSocket    │──► Browser (real-time push)
                 └────────────────┘

            ┌─────────────────────────┐
            │   Apache Kafka          │
            │  (event bus)            │
            │  Topic: post.created    │
            └─────────────────────────┘
```

---

## How It Works

### Fan-out on Write (Feed Generation)
When a user creates a post:
1. `post-service` saves the post to PostgreSQL and publishes a `post.created` event to Kafka
2. `feed-service` consumes the event, calls `user-service` via gRPC to get the poster's followers
3. For each follower, it writes the post to their personal feed in Redis using `ZADD` (score = Unix timestamp)
4. `notification-service` also consumes the same event and pushes a real-time WebSocket notification to connected followers

Feed reads are O(1) — just a `ZREVRANGE` on the Redis Sorted Set with pagination.

### Real-Time Notifications
- Browser connects to `notification-service` WebSocket on page load, authenticating via JWT in the URL
- When a followed user posts, the WebSocket pushes a `new_post` event to the follower's browser
- A banner appears on the feed page: *"N new posts — click to refresh"*

### Inter-Service Communication
All internal service-to-service calls use **gRPC + Protobuf** (not REST) for:
- Type-safe contracts defined once in `/proto`
- Binary serialization (~5x smaller payload than JSON)
- Bi-directional streaming support

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14 App Router | SSR-capable React with file-based routing |
| State | Zustand + persist | Lightweight, no boilerplate vs Redux |
| API Gateway | Express.js | Simple, well-known, easy middleware chain |
| Inter-service RPC | gRPC + Protobuf | Type-safe, efficient binary protocol |
| Event Bus | Apache Kafka | Durable, replayable events; decouples producers/consumers |
| Feed Cache | Redis Sorted Sets | O(log N) insert, O(1) range read for paginated feeds |
| Databases | PostgreSQL | ACID compliance for user and post data |
| Auth | JWT (HS256) | Stateless; gateway verifies, no DB call per request |
| Containers | Docker + Compose | Reproducible local dev environment |
| Orchestration | Kubernetes + HPA | Auto-scales API gateway on CPU load |

---

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| `api-gateway` | 3000 | Single REST entry point, auth, routes to services |
| `user-service` | 50051 (gRPC) | Users, auth (register/login), follow graph |
| `post-service` | 50052 (gRPC) | CRUD for posts, publishes events to Kafka |
| `feed-service` | 50053 (gRPC) | Reads/writes user feeds from Redis |
| `notification-service` | 3001 (WS) | Real-time push via WebSocket |
| `frontend` | 3002 | Next.js UI |

---

## Local Development

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Node.js 20+ (for running the frontend in dev mode)

### Run the Backend
```bash
# Start all backend services (Kafka, Redis, Postgres, 5 microservices)
docker-compose up --build
```

This brings up:
- Zookeeper + Kafka
- Redis
- postgres-user (port 5432) and postgres-post (port 5433)
- All 5 microservices

### Run the Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:3002
```

> The frontend proxies API calls to `http://localhost:3000` (api-gateway) automatically via next.config.mjs rewrites.

---

## API Reference

### Auth
```
POST /auth/register    { username, email, password }
POST /auth/login       { email, password }
```

### Posts
```
POST   /posts              Create a post (auth required)
GET    /posts/:id          Get post by ID
GET    /posts/user/:userId Paginated user posts (?page=1&limit=20)
DELETE /posts/:id          Delete own post (auth required)
```

### Feed
```
GET /feed    Get personalized feed (?page=1&limit=20) (auth required)
```

### Users
```
GET    /users/:id            Get user profile
POST   /users/:id/follow     Follow a user (auth required)
DELETE /users/:id/follow     Unfollow a user (auth required)
GET    /users/:id/followers  List follower IDs
GET    /users/:id/following  List following IDs
```

---

## Kubernetes Deployment

```bash
# Apply all manifests (includes namespace, configmap, all services)
kubectl apply -f k8s/

# Check rollout
kubectl get pods -n feedx
```

The API gateway HorizontalPodAutoscaler scales between 2–10 replicas at 70% CPU.

---

## Project Structure

```
feedx/
├── proto/                  # gRPC Protobuf definitions (shared contracts)
│   ├── user.proto
│   ├── post.proto
│   └── feed.proto
├── services/
│   ├── user-service/       # Auth + follow graph
│   ├── post-service/       # Post CRUD + Kafka producer
│   ├── feed-service/       # Redis fan-out consumer + gRPC server
│   ├── notification-service/ # Kafka consumer + WebSocket server
│   └── api-gateway/        # Express REST gateway
├── frontend/               # Next.js 14 App Router
│   └── src/
│       ├── app/            # Pages (feed, profile, login, register)
│       ├── components/     # Navbar, PostCard, CreatePostModal, etc.
│       ├── hooks/          # useWebSocket
│       ├── lib/            # axios API client
│       └── store/          # Zustand (auth, notifications)
├── k8s/                    # Kubernetes manifests
└── docker-compose.yml
```

---

## Key Design Decisions

**Why fan-out on write instead of fan-out on read?**
Fan-out on read would query all posts from all followed users at read time — expensive at scale. Fan-out on write pre-computes each user's feed asynchronously via Kafka, so feed reads are always O(1) Redis lookups regardless of follower count.

**Why Kafka instead of direct service calls?**
Decouples post creation from feed/notification delivery. If feed-service or notification-service is down, Kafka retains the events and replays them on recovery. Post creation never blocks on downstream consumers.

**Why separate PostgreSQL instances per service?**
Database-per-service is a core microservices pattern — it prevents tight coupling at the data layer. Each service owns its schema and can be scaled, migrated, or replaced independently.
