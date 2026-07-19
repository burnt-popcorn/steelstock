FROM node:18-alpine

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

# Expose Next.js port
EXPOSE 3000

# Start production server
CMD ["npm", "start"]
