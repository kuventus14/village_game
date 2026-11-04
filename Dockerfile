FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY *.js ./
COPY vendor ./vendor
COPY public ./public
ENV PORT=3300
EXPOSE 3300
CMD ["node", "server.js"]
