// /backend/messenger-service/main.go
package main

import (
	"backend/messenger-service/db"
	"backend/messenger-service/handlers"
	"backend/messenger-service/middleware"
	"backend/messenger-service/utils"
	"backend/messenger-service/ws"
	"log"
	"net/http"
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

	// 1. Инициализация и запуск Hub
	hub := ws.NewHub()
	go hub.Run()

	// 2. Инициализация Хендлеров
	conversationHandler := &handlers.ConversationHandler{DB: db.DB, Hub: hub}
	serverHandler := &handlers.ServerHandler{DB: db.DB}
	channelHandler := &handlers.ChannelHandler{DB: db.DB}
	msgHandler := &handlers.MessageHandler{DB: db.DB, Hub: hub}

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// WebSocket Endpoint
	r.GET("/ws", func(c *gin.Context) {
		token := c.Query("token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
			return
		}
		claims, err := utils.ParseToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}
		ws.ServeWs(hub, db.DB, c.Writer, c.Request, claims.UserID)
	})

	// === REST API ===
	api := r.Group("/api/v1")
	{
		protected := api.Group("/")
		protected.Use(middleware.AuthRequired())
		{
			// --- ЧАТЫ ---
			protected.POST("/conversations", conversationHandler.StartChat)
			protected.GET("/conversations", conversationHandler.GetConversations) // Используем единый метод
			protected.GET("/conversations/:id/messages", conversationHandler.GetMessages)
			protected.POST("/conversations/:id/read", conversationHandler.MarkConversationAsRead)
			protected.POST("/groups", conversationHandler.CreateGroup)
			protected.PUT("/groups/:id", conversationHandler.UpdateGroup)

			// --- СООБЩЕНИЯ (Исправлено api. -> protected.) ---
			protected.PUT("/messages/:id", msgHandler.EditMessage)
			protected.DELETE("/messages/:id", msgHandler.DeleteMessage)
			protected.POST("/messages/:id/pin", msgHandler.PinMessage)
			protected.POST("/messages/forward", msgHandler.ForwardMessage)
			protected.POST("/messages/attachment", msgHandler.SendAttachment)

			// --- СЕРВЕРА ---
			protected.POST("/servers", serverHandler.CreateServer)
			protected.GET("/servers", serverHandler.GetServers)
			protected.POST("/servers/join", serverHandler.JoinServer)
			protected.PUT("/servers/:id", serverHandler.UpdateServer)
			protected.POST("/servers/:id/leave", serverHandler.LeaveServer)
			protected.DELETE("/servers/:id", serverHandler.DeleteServer)

			// --- КАНАЛЫ ---
			protected.POST("/channels", channelHandler.CreateChannel)
			protected.GET("/servers/:server_id/channels", channelHandler.GetChannelsByServerID)
			protected.DELETE("/channels/:id", channelHandler.DeleteChannel)
		}
	}

	log.Println("Messenger Service running on :8082")
	if err := r.Run(":8082"); err != nil {
		log.Fatal("Failed to run server: ", err)
	}
}
