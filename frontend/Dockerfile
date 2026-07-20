FROM node:20-alpine as builder

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Run production build
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve to run static exports
RUN npm install -g serve

# Copy built static files from builder
COPY --from=builder /app/out ./out

# Expose port
EXPOSE 3000

# Serve static files
CMD ["serve", "-s", "out", "-l", "3000"]
