FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy only the package files first (better for caching)
COPY package*.json ./

# Install dependencies
RUN npm cache clean --force && npm ci --only=production

# Copy the rest of your backend code
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Start the app
CMD ["node", "server.js"]
