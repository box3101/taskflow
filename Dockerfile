FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
RUN cd frontend && npm ci
RUN cd backend && npm ci
COPY frontend ./frontend
COPY backend ./backend
RUN cd frontend && npm run build
# Prisma generation reads the configuration, but does not connect to this placeholder.
RUN cd backend && DATABASE_URL=postgresql://build:build@localhost/build npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/surge-python
ENV PATH="/opt/surge-python/bin:$PATH"
ENV PYTHON_BIN=python
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/scripts/requirements-surge.txt ./scripts/requirements-surge.txt
RUN pip install --no-cache-dir -r scripts/requirements-surge.txt
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/generated ./generated
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts backend/package.json ./
COPY backend/scripts ./scripts
COPY --from=build /app/frontend/dist /app/frontend/dist
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
