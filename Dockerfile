# ---------- Stage 1: build frontend + compile server ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-fund --no-audit || npm install --no-fund --no-audit

COPY . .
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    DIST_DIR=/app/dist

# php-cli is required by the platform CLI (phar); curl/git for installer + ssh
RUN apt-get update \
 && apt-get install -y --no-install-recommends php-cli curl git openssh-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install the Platform/Upsun CLI under /opt so a volume mounted at
# /home/node/.platformsh (session/ssh state) can never shadow the binary.
# The installer's self:install step returns non-zero without a TTY, so its
# exit code is ignored and the binary is verified explicitly afterwards.
RUN mkdir -p /opt/psh-cli \
 && curl -fsSL https://platform.sh/cli/installer -o /tmp/psh-installer.php \
 && HOME=/opt/psh-cli php /tmp/psh-installer.php > /dev/null 2>&1 || true \
 && test -x /opt/psh-cli/.platformsh/bin/platform \
 && ln -s /opt/psh-cli/.platformsh/bin/platform /usr/local/bin/platform \
 && chmod -R a+rX /opt/psh-cli \
 && rm -f /tmp/psh-installer.php \
 && platform --version

USER node
RUN mkdir -p /home/node/.platformsh
WORKDIR /app

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server-dist ./server-dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "server-dist/index.js"]
