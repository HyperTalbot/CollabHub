FROM node:18-alpine

WORKDIR /app

# Копируем зависимости
COPY package.json package-lock.json ./
RUN npm install

# Копируем код
COPY . .

# Собираем проект
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]