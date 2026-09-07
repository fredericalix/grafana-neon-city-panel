FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY loadgen.js ./
EXPOSE 8080
USER node
CMD ["node", "loadgen.js"]
