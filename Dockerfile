FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm install
COPY . .
ENV NITRO_PRESET=node-server
RUN npm run build
ENV HOST=0.0.0.0 PORT=8080 NITRO_HOST=0.0.0.0 NITRO_PORT=8080
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
