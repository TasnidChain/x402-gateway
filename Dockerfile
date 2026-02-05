FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy monorepo
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build facilitator
WORKDIR /app/packages/facilitator
RUN pnpm build

# Expose port
EXPOSE 3002

# Start
CMD ["pnpm", "start"]
