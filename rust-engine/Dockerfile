# Build stage — full Rust toolchain
FROM rust:1.82-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first (layer cache for dependencies)
COPY Cargo.toml ./
COPY Cargo.lock* ./

# Pre-fetch and compile dependencies (cached unless Cargo.toml changes)
RUN mkdir src && echo 'fn main(){}' > src/main.rs
RUN cargo build --release --locked
RUN rm -rf src

# Copy actual source code and build for real
COPY src ./src
RUN touch src/main.rs
RUN cargo build --release --locked

# ─── Runtime stage — minimal Debian with only what's needed ───────────────────
FROM debian:bookworm-slim

# SSL certificates for HTTPS fetching
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy only the compiled binary
COPY --from=builder /app/target/release/realssa-engine /usr/local/bin/realssa-engine

# Fly.io uses PORT env var
ENV PORT=8080
EXPOSE 8080

# Run as non-root for security
RUN useradd -r -s /bin/false engine
USER engine

CMD ["realssa-engine"]
