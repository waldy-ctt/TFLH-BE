# Use official Bun image (Alpine for minimal size)
FROM oven/bun:1-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Create directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD bun --eval "fetch('http://localhost:3000/api/users').then(() => process.exit(0)).catch(() => process.exit(1))"

# Run the application
CMD ["bun", "run", "src/index.ts", "--host", "0.0.0.0"]
