package middlewares

import (
	"backend/post-service/utils"
	"strings"

	"github.com/gin-gonic/gin"
)

// Пытается аутентифицировать, но не блокирует, если не удалось
func AuthOptional() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Получаем заголовок Authorization
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Set("userID", uint(0)) // Устанавливаем UserID = 0 (Гость)
			c.Next()
			return
		}

		// Проверяем формат
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.Set("userID", uint(0))
			c.Next()
			return
		}
		tokenString := parts[1]

		// Валидируем токен
		claims, err := utils.ParseToken(tokenString)
		if err != nil {
			c.Set("userID", uint(0)) // Токен не валиден
			c.Next()
			return
		}

		// Успех, токен валиден, устанавливаем ID
		c.Set("userID", claims.UserID)
		c.Next()
	}
}
