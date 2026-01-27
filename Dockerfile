FROM node:24-alpine AS build

RUN npm i -g pnpm@10

WORKDIR /app
COPY pnpm-lock.yaml package.json tsconfig.json ./
RUN pnpm install --frozen-lockfile
COPY src/ src/
RUN pnpm build

FROM node:24-alpine

RUN npm i -g @anthropic-ai/claude-code

WORKDIR /app
COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/dist/ dist/

ENV DB_PATH=/data/bot.db
ENV TIMEZONE=UTC
VOLUME ["/data", "/root/.claude"]

CMD ["node", "dist/main.js"]
