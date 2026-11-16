# Qoddy: build with pnpm, run the adapter-node output on Node 24.
#
#   docker build -t qoddy .
#   docker run -d --name qoddy -p 3000:3000 -v qoddy-data:/data \
#     -e ORIGIN=https://qoddy.example qoddy
#   echo 'a long password' | docker exec -i qoddy qoddy create-user you@example.com "You" --admin

FROM node:24-slim AS build
RUN npm install -g pnpm@10.24.0
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning \
    DATABASE_PATH=/data/qoddy.db
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# The CLI runs from source under Node's type stripping.
COPY --from=build /app/scripts/cli.ts ./scripts/cli.ts
COPY --from=build /app/src/lib ./src/lib
RUN printf '#!/bin/sh\nexec node /app/scripts/cli.ts "$@"\n' > /usr/local/bin/qoddy \
    && chmod +x /usr/local/bin/qoddy \
    && mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "build"]
