FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build and migrate database
RUN npm run build

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
