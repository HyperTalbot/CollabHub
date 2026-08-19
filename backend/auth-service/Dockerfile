# Stage 1: Build
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Собираем бинарник. CGO_ENABLED=0 делает его полностью статичным.
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/main.go 
# (убедитесь что путь ./cmd/main.go правильный для вашего проекта)

# Stage 2: Run
FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/main .
# Если есть .env файлы или конфиги, их тоже нужно скопировать, 
# но лучше передавать переменные через docker-compose
EXPOSE 8080 
CMD ["./main"]
