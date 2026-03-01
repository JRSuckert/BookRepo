FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY src/package.json ./
RUN npm install --omit=dev

# Copy application source
COPY src/ ./

# Books are mounted at runtime; create the default mount point
RUN mkdir -p /books

EXPOSE 3000

ENV BOOKS_DIR=/books \
    PORT=3000 \
    RESCAN_SEC=300

CMD ["node", "server.js"]
