FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy only the package files first (better for caching)
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN apk add --no-cache curl && \
    yarn install --production --frozen-lockfile

# Copy the rest of your backend code
COPY . .

# Start the app
CMD ["node", "server.js"]
