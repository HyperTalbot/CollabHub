// backend/video-service/main.go
package main

import (
	"backend/video-service/db"
	"backend/video-service/handlers"
	"backend/video-service/middleware"
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	database, err := db.InitDB()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "https://collabhub.cloudpub.ru"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	videoHandler := &handlers.VideoHandler{DB: database}
	commentHandler := &handlers.CommentHandler{DB: database}
	likeHandler := &handlers.LikeHandler{DB: database}
	playlistHandler := &handlers.PlaylistHandler{DB: database}
	subscriptionHandler := &handlers.SubscriptionHandler{DB: database}

	api := r.Group("/api/v1/video")
	{
		// Публичные endpoints
		api.GET("/videos", videoHandler.GetVideos)
		api.GET("/videos/:id", videoHandler.GetVideoByID)
		api.GET("/search", videoHandler.SearchVideos)
		api.POST("/videos/:id/view", middleware.AuthOptional(), videoHandler.IncrementViewCount)
		api.GET("/videos/:id/comments", commentHandler.GetComments)
		api.GET("/playlists/:id", playlistHandler.GetPlaylistByID)
		api.GET("/playlists/public", playlistHandler.GetPublicPlaylists)
		api.GET("/channels/:channelId/subscribers", subscriptionHandler.GetSubscriberCount)

		// Защищенные endpoints
		protected := api.Group("/")
		protected.Use(middleware.AuthRequired())
		{
			// Видео
			protected.POST("/videos", videoHandler.CreateVideo)
			protected.GET("/my-videos", videoHandler.GetUserVideos)
			protected.DELETE("/videos/:id", videoHandler.DeleteVideo)
			protected.GET("/view-history", videoHandler.GetViewHistory)

			// Комментарии
			protected.POST("/videos/:id/comments", commentHandler.CreateComment)
			protected.DELETE("/comments/:commentId", commentHandler.DeleteComment)

			// Лайки
			protected.POST("/videos/:id/like", likeHandler.LikeVideo)
			protected.POST("/videos/:id/dislike", likeHandler.DislikeVideo)
			protected.GET("/videos/:id/like-status", likeHandler.GetUserLikeStatus)

			// Плейлисты
			protected.POST("/playlists", playlistHandler.CreatePlaylist)
			protected.GET("/playlists", playlistHandler.GetUserPlaylists)
			protected.DELETE("/playlists/:id", playlistHandler.DeletePlaylist)
			protected.POST("/playlists/:id/videos", playlistHandler.AddVideoToPlaylist)
			protected.DELETE("/playlists/:id/videos/:videoId", playlistHandler.RemoveVideoFromPlaylist)

			// Подписки
			protected.POST("/channels/:channelId/subscribe", subscriptionHandler.Subscribe)
			protected.GET("/channels/:channelId/subscription-status", subscriptionHandler.GetSubscriptionStatus)
			protected.GET("/subscriptions", subscriptionHandler.GetUserSubscriptions)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Video service started on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
