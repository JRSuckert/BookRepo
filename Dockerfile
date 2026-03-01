FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY src/package.json ./
RUN npm install --omit=dev

# Copy application source
COPY src/ ./

# Books are mounted at runtime; create default mount points
RUN mkdir -p /books /data

EXPOSE 3000

ENV BOOKS_DIR=/books \
    CACHE_FILE=/data/library-cache.json \
    PORT=3000 \
    RESCAN_SEC=300

CMD ["node", "server.js"]
