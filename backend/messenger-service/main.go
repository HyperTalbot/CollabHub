// // /backend/messenger-service/main.go
// package main

// import (
// 	"backend/messenger-service/db"
// 	"backend/messenger-service/handlers"
// 	"backend/messenger-service/middleware"
// 	"backend/messenger-service/utils"
// 	"backend/messenger-service/ws"
// 	"log"
// 	"net/http"
// 	"time"

// 	"github.com/gin-contrib/cors"
// 	"github.com/gin-gonic/gin"
// 	"github.com/joho/godotenv"
// )

// func main() {
// 	err := godotenv.Load()
// 	if err != nil {
// 		log.Println("Error loading .env file")
// 	}

// 	db.InitDB()

// 	// 1. Инициализация и запуск Hub
// 	hub := ws.NewHub()
// 	go hub.Run()

// 	voiceState := ws.NewVoiceState()

// 	// 2. Инициализация Хендлеров
// 	conversationHandler := &handlers.ConversationHandler{DB: db.DB, Hub: hub}
// 	groupHandler := &handlers.GroupHandler{DB: db.DB, Hub: hub}
// 	serverHandler := &handlers.ServerHandler{DB: db.DB}
// 	channelHandler := &handlers.ChannelHandler{DB: db.DB}
// 	msgHandler := &handlers.MessageHandler{DB: db.DB, Hub: hub}
// 	callHandler := &handlers.CallHandler{DB: db.DB, Hub: hub}
// 	voiceChannelHandler := &handlers.VoiceChannelHandler{DB: db.DB, Hub: hub, VoiceState: voiceState}

// 	r := gin.Default()

// 	// CORS
// 	r.Use(cors.New(cors.Config{
// 		AllowOrigins:     []string{"http://localhost:3000"},
// 		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
// 		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
// 		AllowCredentials: true,
// 		MaxAge:           12 * time.Hour,
// 	}))

// 	// WebSocket Endpoint
// 	r.GET("/ws", func(c *gin.Context) {
// 		token := c.Query("token")
// 		if token == "" {
// 			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
// 			return
// 		}
// 		claims, err := utils.ParseToken(token)
// 		if err != nil {
// 			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
// 			return
// 		}
// 		ws.ServeWs(hub, db.DB, c.Writer, c.Request, claims.UserID)
// 	})

// 	// === REST API ===
// 	api := r.Group("/api/v1")
// 	{
// 		protected := api.Group("/")
// 		protected.Use(middleware.AuthRequired())
// 		{
// 			// --- ЧАТЫ ---
// 			protected.POST("/conversations", conversationHandler.StartChat)
// 			protected.GET("/conversations", conversationHandler.GetConversations) // Используем единый метод
// 			protected.GET("/conversations/:id/messages", conversationHandler.GetMessages)
// 			protected.POST("/conversations/:id/read", conversationHandler.MarkConversationAsRead)

// 			// --- СООБЩЕНИЯ (Исправлено api. -> protected.) ---
// 			protected.PUT("/messages/:id", msgHandler.EditMessage)
// 			protected.DELETE("/messages/:id", msgHandler.DeleteMessage)
// 			protected.POST("/messages/:id/pin", msgHandler.PinMessage)
// 			protected.POST("/messages/forward", msgHandler.ForwardMessage)
// 			protected.POST("/messages/attachment", msgHandler.SendAttachment)

// 			// Группы (отдельные эндпоинты)
// 			protected.POST("/groups", groupHandler.CreateGroup)
// 			protected.GET("/groups", groupHandler.GetGroups)
// 			protected.GET("/groups/:id/messages", groupHandler.GetGroupMessages)
// 			protected.PUT("/groups/:id", groupHandler.UpdateGroup)
// 			protected.DELETE("/groups/:id", groupHandler.DeleteGroup)

// 			// --- СЕРВЕРА ---
// 			protected.POST("/servers", serverHandler.CreateServer)
// 			protected.GET("/servers", serverHandler.GetServers)
// 			protected.POST("/servers/join", serverHandler.JoinServer)
// 			protected.PUT("/servers/:id", serverHandler.UpdateServer)
// 			protected.POST("/servers/:id/leave", serverHandler.LeaveServer)
// 			protected.DELETE("/servers/:id", serverHandler.DeleteServer)

// 			// --- КАНАЛЫ ---
// 			protected.POST("/channels", channelHandler.CreateChannel)
// 			protected.GET("/servers/:server_id/channels", channelHandler.GetChannelsByServerID)
// 			protected.DELETE("/channels/:id", channelHandler.DeleteChannel)

// 			// --- ЗВОНКИ ---
// 			protected.POST("/calls", callHandler.InitiateCall)
// 			protected.POST("/calls/:id/answer", callHandler.AnswerCall)
// 			protected.POST("/calls/:id/decline", callHandler.DeclineCall)
// 			protected.POST("/calls/:id/end", callHandler.EndCall)
// 			protected.POST("/calls/:id/ice", callHandler.ICECandidate)
// 			protected.GET("/conversations/:conversation_id/calls", callHandler.GetCallHistory)

// 			// --- ДЕМОНСТРАЦИЯ ЭКРАНА ---
// 			protected.POST("/calls/:id/screen-share", callHandler.StartScreenShare)
// 			protected.POST("/screen-shares/:id/stop", callHandler.StopScreenShare)

// 			// --- ГОЛОСОВЫЕ КАНАЛЫ ---
// 			protected.POST("/channels/:id/voice/join", voiceChannelHandler.JoinVoiceChannel)
// 			protected.POST("/channels/:id/voice/leave", voiceChannelHandler.LeaveVoiceChannel)
// 			protected.GET("/channels/:id/voice/participants", voiceChannelHandler.GetVoiceChannelParticipants)
// 			protected.POST("/voice/signal", voiceChannelHandler.VoiceSignaling)
// 		}
// 	}

// 	log.Println("Messenger Service running on :8086")
// 	if err := r.Run(":8086"); err != nil {
// 		log.Fatal("Failed to run server: ", err)
// 	}
// }

// backend/messenger-service/main.go
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
		log.Println("⚠️  Warning: .env file not found")
	}

	db.InitDB()

	// Инициализация Hub и VoiceState
	hub := ws.NewHub()
	voiceState := ws.NewVoiceState()
	go hub.Run()

	// Инициализация всех хендлеров
	conversationHandler := &handlers.ConversationHandler{DB: db.DB, Hub: hub}
	groupHandler := &handlers.GroupHandler{DB: db.DB, Hub: hub}
	serverHandler := &handlers.ServerHandler{DB: db.DB}
	channelHandler := &handlers.ChannelHandler{DB: db.DB}
	msgHandler := &handlers.MessageHandler{DB: db.DB, Hub: hub}
	callHandler := &handlers.CallHandler{DB: db.DB, Hub: hub}
	voiceChannelHandler := &handlers.VoiceChannelHandler{DB: db.DB, Hub: hub, VoiceState: voiceState}
	reactionHandler := &handlers.ReactionHandler{DB: db.DB, Hub: hub}
	statusHandler := &handlers.StatusHandler{DB: db.DB, Hub: hub}
	searchHandler := &handlers.SearchHandler{DB: db.DB}
	pinHandler := &handlers.PinHandler{DB: db.DB, Hub: hub}
	blockHandler := &handlers.BlockHandler{DB: db.DB}
	inviteHandler := &handlers.InviteHandler{DB: db.DB}
	pollHandler := &handlers.PollHandler{DB: db.DB, Hub: hub}
	notificationHandler := &handlers.NotificationHandler{DB: db.DB}
	roleHandler := &handlers.RoleHandler{DB: db.DB}

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// // Health check
	// r.GET("/health", func(c *gin.Context) {
	// 	c.JSON(http.StatusOK, gin.H{
	// 		"status":  "healthy",
	// 		"service": "messenger-service",
	// 		"version": "1.0.0",
	// 	})
	// })

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
		// Публичные эндпоинты
		api.POST("/invite/:code/join", inviteHandler.JoinByInvite)

		protected := api.Group("/")
		protected.Use(middleware.AuthRequired())
		{
			// --- ЛИЧНЫЕ ЧАТЫ ---
			protected.POST("/conversations", conversationHandler.StartChat)
			protected.GET("/conversations", conversationHandler.GetConversations)
			protected.GET("/conversations/:id", conversationHandler.GetConversationByID)
			protected.GET("/conversations/:id/messages", conversationHandler.GetMessages)
			protected.POST("/conversations/:id/read", conversationHandler.MarkConversationAsRead)

			// --- СООБЩЕНИЯ ---
			// ВАЖНО: специфичные роуты ПЕРЕД общими роутами с wildcard
			protected.POST("/messages/send", msgHandler.SendMessage)
			protected.POST("/messages/forward", msgHandler.ForwardMessage)
			protected.POST("/messages/attachment", msgHandler.SendAttachment)

			// Операции с конкретным сообщением
			protected.PUT("/messages/:id/edit", msgHandler.EditMessage)
			protected.DELETE("/messages/:id/delete", msgHandler.DeleteMessage)
			protected.POST("/messages/:id/pin", msgHandler.PinMessage)

			// --- РЕАКЦИИ (теперь не конфликтуют) ---
			protected.POST("/messages/:id/reactions", reactionHandler.AddReaction)
			protected.GET("/messages/:id/reactions", reactionHandler.GetReactions)

			// --- ГРУППЫ ---
			protected.POST("/groups", groupHandler.CreateGroup)
			protected.GET("/groups", groupHandler.GetGroups)
			protected.GET("/groups/:id", groupHandler.GetGroupByID)
			protected.GET("/groups/:id/messages", groupHandler.GetGroupMessages)
			protected.PUT("/groups/:id", groupHandler.UpdateGroup)
			protected.DELETE("/groups/:id", groupHandler.DeleteGroup)

			// --- СЕРВЕРА ---
			protected.POST("/servers", serverHandler.CreateServer)
			protected.GET("/servers", serverHandler.GetServers)
			protected.POST("/servers/join", serverHandler.JoinServer)
			protected.PUT("/servers/:id", serverHandler.UpdateServer)
			protected.POST("/servers/:id/leave", serverHandler.LeaveServer)
			protected.DELETE("/servers/:id", serverHandler.DeleteServer)

			// --- КАНАЛЫ ---
			protected.POST("/channels", channelHandler.CreateChannel)
			protected.GET("/servers/:id/channels", channelHandler.GetChannelsByServerID)
			protected.GET("/channels/:id/messages", channelHandler.GetChannelMessages)
			protected.DELETE("/channels/:id", channelHandler.DeleteChannel)

			// Голосовые каналы (специфичные роуты перед общими)
			protected.POST("/channels/:id/voice/join", voiceChannelHandler.JoinVoiceChannel)
			protected.POST("/channels/:id/voice/leave", voiceChannelHandler.LeaveVoiceChannel)
			protected.GET("/channels/:id/voice/participants", voiceChannelHandler.GetVoiceChannelParticipants)

			// --- ЗВОНКИ ---
			protected.POST("/calls", callHandler.InitiateCall)
			protected.POST("/calls/:id/answer", callHandler.AnswerCall)
			protected.POST("/calls/:id/decline", callHandler.DeclineCall)
			protected.POST("/calls/:id/end", callHandler.EndCall)
			protected.POST("/calls/:id/ice", callHandler.ICECandidate)
			protected.POST("/calls/:id/screen-share", callHandler.StartScreenShare)
			protected.GET("/conversations/:id/calls", callHandler.GetCallHistory)

			// ДОБАВЛЕНО: WebRTC сигналинг
			protected.POST("/calls/:id/signal", callHandler.VoiceSignaling)

			// --- ДЕМОНСТРАЦИЯ ЭКРАНА ---
			protected.POST("/screen-shares/:id/stop", callHandler.StopScreenShare)

			// --- ГОЛОСОВАЯ СИГНАЛИЗАЦИЯ ---
			protected.POST("/voice/signal", voiceChannelHandler.VoiceSignaling)

			// --- СТАТУСЫ ---
			protected.PUT("/status", statusHandler.UpdateStatus)
			protected.GET("/users/:user_id/status", statusHandler.GetUserStatus)
			protected.POST("/typing", statusHandler.SendTypingIndicator)

			// --- ПОИСК ---
			protected.GET("/search/messages", searchHandler.SearchMessages)
			protected.GET("/search/users", searchHandler.SearchUsers)

			// --- ЗАКРЕПЛЕННЫЕ СООБЩЕНИЯ ---
			protected.POST("/pin", pinHandler.PinMessageToChat)
			protected.DELETE("/pin/:message_id", pinHandler.UnpinMessage)
			protected.GET("/pinned", pinHandler.GetPinnedMessages)

			// --- БЛОКИРОВКА ---
			protected.POST("/block", blockHandler.BlockUser)
			protected.DELETE("/block/:user_id", blockHandler.UnblockUser)
			protected.GET("/blocked", blockHandler.GetBlockedUsers)

			// --- ИНВАЙТЫ ---
			protected.POST("/invites", inviteHandler.CreateInvite)
			protected.GET("/servers/:id/invites", inviteHandler.GetServerInvites)
			protected.DELETE("/invites/:code", inviteHandler.DeleteInvite)

			// --- ОПРОСЫ ---
			protected.POST("/polls", pollHandler.CreatePoll)
			protected.POST("/polls/:poll_id/vote", pollHandler.VoteInPoll)
			protected.GET("/polls/:poll_id/results", pollHandler.GetPollResults)

			// --- УВЕДОМЛЕНИЯ ---
			protected.GET("/notifications/settings", notificationHandler.GetNotificationSettings)
			protected.PUT("/notifications/settings", notificationHandler.UpdateNotificationSettings)

			// Mute/Unmute для разных типов чатов
			protected.POST("/notifications/mute/conversation", notificationHandler.MuteConversation)
			protected.DELETE("/notifications/mute/conversation/:conversation_id", notificationHandler.UnmuteConversation)
			protected.POST("/notifications/mute/group", notificationHandler.MuteGroup)
			protected.DELETE("/notifications/mute/group/:group_id", notificationHandler.UnmuteGroup)
			protected.POST("/notifications/mute/server", notificationHandler.MuteServer)
			protected.DELETE("/notifications/mute/server/:server_id", notificationHandler.UnmuteServer)

			// --- РОЛИ ---
			protected.POST("/roles", roleHandler.CreateRole)
			protected.POST("/roles/assign", roleHandler.AssignRole)
			protected.GET("/servers/:id/roles", roleHandler.GetServerRoles)
		}
	}

	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("✅ Messenger Service running on :8086")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("📋 Available Features:")
	log.Println("   • Personal Chats (DM)")
	log.Println("   • Groups")
	log.Println("   • Servers & Channels")
	log.Println("   • Audio/Video Calls")
	log.Println("   • Screen Sharing")
	log.Println("   • Voice Channels")
	log.Println("   • Reactions & Polls")
	log.Println("   • Search & Notifications")
	log.Println("   • Roles & Permissions")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("🌐 WebSocket: ws://localhost:8086/ws?token=YOUR_TOKEN")
	log.Println("🔗 API: http://localhost:8086/api/v1")
	// log.Println("💚 Health: http://localhost:8086/health")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	if err := r.Run(":8086"); err != nil {
		log.Fatal("Failed to run server: ", err)
	}
}
