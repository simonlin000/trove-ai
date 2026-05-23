FROM node:20-alpine

WORKDIR /app

# China mirrors for faster npm + alpine packages
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tencent.com|g' /etc/apk/repositories \
    && npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
