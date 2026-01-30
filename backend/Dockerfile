FROM node:18-alpine
WORKDIR /app
COPY package*.json ./

# Install yarn and clear cache
RUN npm install -g yarn && \
    npm cache clean --force && \
    yarn config set network-timeout 600000

# Install dependencies with retry mechanism using yarn
RUN apk add --no-cache curl && \
    for i in {1..3}; do \
        if yarn install --production --frozen-lockfile; then \
            echo "Dependencies installed successfully"; \
            break; \
        else \
            echo "Attempt $i failed, retrying..."; \
            sleep 5; \
        fi; \
    done

COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
