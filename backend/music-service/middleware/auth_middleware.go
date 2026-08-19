package middleware

import (
	"backend/music-service/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthRequired проверяет JWT токен и извлекает user_id (ПЕРЕИМЕНОВАНО)
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
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

		// ИСПРАВЛЕНО: Добавляем username в контекст
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username) // РАСКОММЕНТИРОВАНО

		c.Next()
	}
}

// OptionalAuthMiddleware проверяет токен, но не требует его обязательно
// Если токен есть и валиден - добавляет user_id в контекст
// Если токена нет или он невалиден - продолжает без user_id
func AuthOptional() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]
		claims, err := utils.ParseToken(tokenString)
		if err != nil {
			c.Next()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username) // РАСКОММЕНТИРОВАНО

		c.Next()
	}
}
