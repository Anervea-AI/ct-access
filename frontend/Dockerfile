FROM node:22-alpine AS builder

WORKDIR /app

# VITE_API_BASE="" makes the frontend use relative URLs (/api/...)
# which nginx then proxies to the backend container.
# Override at build time for direct-to-backend mode:
#   docker compose build --build-arg VITE_API_BASE=http://<server>:9801
ARG VITE_API_BASE=""

COPY package*.json ./
RUN npm install

COPY . .
# Skip tsc type-check (done locally); vite build handles transpilation
RUN VITE_API_BASE=$VITE_API_BASE npx vite build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
