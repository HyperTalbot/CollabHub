package middlewares

import (
	"backend/post-service/utils" // ВНИМАНИЕ: Меняйте путь импорта для каждого сервиса (auth-service/utils и т.д.)
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthRequired - Проверяет ТОЛЬКО валидность токена
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims, err := utils.ParseToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// === ВАЖНОЕ ИСПРАВЛЕНИЕ ===
		// 1. Мы НЕ проверяем тут роль admin. Мы пускаем всех залогиненных.
		// 2. Мы сохраняем роль в контекст, чтобы AdminRequired мог её прочитать.
		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role) // <--- ЭТОГО НЕ ХВАТАЛО

		c.Next()
	}
}

// AdminRequired - Проверяет ТОЛЬКО роль (ставится ПОСЛЕ AuthRequired)
func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Читаем роль из контекста (куда её положил AuthRequired)
		role, exists := c.Get("role")

		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: role not found in context"})
			c.Abort()
			return
		}

		// Приведение типа interface{} -> string
		if roleStr, ok := role.(string); !ok || roleStr != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin privileges required"})
			c.Abort()
			return
		}

		c.Next()
	}
}
