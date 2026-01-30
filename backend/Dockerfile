FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy only the package files first (better for caching)
COPY package*.json ./

# Clear npm cache and install dependencies without cache or integrity checks
RUN npm cache clean --force && npm install --no-cache --omit=dev --no-audit --ignore-scripts

# Copy the rest of your backend code
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Start the app
CMD ["node", "server.js"]
