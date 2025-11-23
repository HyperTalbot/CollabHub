package main

import (
	"backend/messenger-service/db"
	"backend/messenger-service/handlers"
	middlewares "backend/messenger-service/middleware"
	"backend/messenger-service/utils"
	"backend/messenger-service/ws"
	"net/http"

	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file")
	}

	db.InitDB()

	hub := ws.NewHub()
	go hub.Run()

	conversationHandler := &handlers.ConversationHandler{DB: db.DB}

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// WebSocket Endpoint (публичный, токен проверяем внутри)
	r.GET("/ws", func(c *gin.Context) {
		// Получаем токен из URL Query: /ws?token=...
		token := c.Query("token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
			return
		}

		// Валидируем токен вручную
		claims, err := utils.ParseToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		// Апгрейд соединения через ws.ServeWs
		ws.ServeWs(hub, db.DB, c.Writer, c.Request, claims.UserID)
	})

	api := r.Group("/api/v1")
	{
		// Группа защищенных роутов
		protected := api.Group("/")

		protected.Use(middlewares.AuthRequired()) // Требует токен
		{
			// Начать чат (или получить существующий)
			protected.POST("/conversations", conversationHandler.StartChat)

			// Получить список моих чатов
			protected.GET("/conversations", conversationHandler.GetMyConversations)

			protected.GET("/conversations/:id/messages", conversationHandler.GetMessages)

			protected.POST("/conversations/:id/read", conversationHandler.MarkConversationAsRead)
		}
	}

	log.Println("Messenger Service running on :8082")
	if err := r.Run(":8082"); err != nil {
		log.Fatal("Failed to run server: ", err)
	}
}
