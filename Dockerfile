FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build



FROM node:22-alpine

ENV NODE_ENV=production

RUN mkdir -p /app && chown node:node /app

WORKDIR /app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev
COPY --from=builder --chown=node:node /app/dist ./

EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && node index.js"]
