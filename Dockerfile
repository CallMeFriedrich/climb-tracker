# syntax=docker/dockerfile:1
FROM node:20-alpine

# better-sqlite3 braucht build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY db ./db
COPY public ./public
COPY scripts ./scripts

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV SESSION_SECRET=CHANGE_ME_IN_RUNTIME

EXPOSE 3000
CMD ["node", "server.js"]
