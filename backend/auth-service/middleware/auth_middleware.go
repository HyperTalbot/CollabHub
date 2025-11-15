package middleware

import (
	"backend/auth-service/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Middleware (посредник) Gin
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Получаем заголовок Authorization
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization"})
			c.Abort() // Остановить дальнейшую обработку
			return
		}

		// Проверяем формат: "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format. Use 'Bearer <token>'."})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Валидируем токен
		claims, err := utils.ParseToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token."})
			c.Abort()
			return
		}

		// Если токен валиден, сохраняем данные пользователя в контексте Gin
		// Это позволит нам получить UserID в любом обработчике (хэндлере)
		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)

		c.Next() // Продолжить выполнение запроса к основному обработчику
	}
}
