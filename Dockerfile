FROM node:lts-alpine as builder

ENV NODE_ENV=development

WORKDIR /app

COPY ["package.json", "package-lock.json", "./"]

RUN npm install

COPY . .

RUN [ "npm", "run", "build"]

FROM node:lts-alpine as production

ENV NODE_ENV=production

WORKDIR /app

COPY ["package.json", "./"]

COPY --from=builder /app/dist ./dist

CMD [ "npm", "start" ]
