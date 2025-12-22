package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt"
	"github.com/joho/godotenv"
)

// Структура Claims должна совпадать с Auth Service
type Claims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.StandardClaims
}

// ParseToken использует ключ из ENV
func ParseToken(tokenString string) (*Claims, error) {
	// ВАЖНО: Читаем ключ из environment, как в Auth Service
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// Фоллбэк только для тестов, в проде это ошибка
		secret = "your_secret_key"
	}
	jwtKey := []byte(secret)

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, err
}

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "No token header"})
			return
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			return
		}
		_, err := ParseToken(parts[1])
		if err != nil {
			// Логируем ошибку для отладки
			fmt.Println("Token validation error:", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token signature"})
			return
		}
		c.Next()
	}
}

func UploadHandler(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil { /*...*/
	}

	// Читаем тип загрузки (avatar, cover, post)
	uploadType := c.Query("type")
	if uploadType == "" {
		uploadType = "misc" // По умолчанию
	}

	// Создаем подпапку: ./uploads/avatars
	uploadPath := filepath.Join(".", "uploads", uploadType)
	if _, err := os.Stat(uploadPath); os.IsNotExist(err) {
		os.MkdirAll(uploadPath, 0755) // MkdirAll создает вложенные папки
	}

	// Генерируем имя
	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
	filename = strings.ReplaceAll(filename, " ", "_")
	dst := filepath.Join(uploadPath, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil { /*...*/
	}

	// Формируем URL: http://.../uploads/avatars/filename.jpg
	url := fmt.Sprintf("http://localhost:8084/uploads/%s/%s", uploadType, filename)

	c.JSON(http.StatusOK, gin.H{"url": url, "type": uploadType})
}

func main() {
	// Загрузка .env (должен лежать в корне media-service или выше)
	// Если запускаете из корня backend, путь может отличаться
	_ = godotenv.Load()

	r := gin.Default()

	// Увеличиваем лимит на загрузку (по дефолту 32MB)
	r.MaxMultipartMemory = 8 << 20 // 8 MiB

	r.Static("/uploads", "./uploads")

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	api := r.Group("/api/v1")
	{
		// ИСПРАВЛЕНО: Роут называется /upload (единственное число), как на фронте
		api.POST("/upload", AuthRequired(), UploadHandler)
	}

	log.Println("Media Service running on :8084")
	r.Run(":8084")
}
