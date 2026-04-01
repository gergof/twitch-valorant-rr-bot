FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci



FROM deps AS build

WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
RUN npm run build



FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY mikro-orm.config.ts ./
COPY tsconfig.json ./
COPY src ./src
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx mikro-orm migration:up && node dist/index.js"]
