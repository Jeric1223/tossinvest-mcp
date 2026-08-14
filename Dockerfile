# syntax=docker/dockerfile:1

# Build stage: compile TypeScript with dev dependencies available.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Runtime stage: production dependencies and compiled output only.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# The symbol index is fetched on first run and cached here.
RUN mkdir -p /app/cache && chown -R node:node /app/cache
USER node

# Credentials are supplied at run time, never baked into the image:
#   docker run -i -e TOSS_CLIENT_ID=... -e TOSS_CLIENT_SECRET=... <image>
# The server speaks MCP over stdio, so stdin must stay open (-i).
ENTRYPOINT ["node", "dist/src/index.js"]
