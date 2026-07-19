FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install production dependencies
RUN npm install

# Copy configuration and source files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose backend port
EXPOSE 5001

# Execute startup script
CMD ["./docker-start.sh"]
