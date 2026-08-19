// backend/media-service/main.go
package main

import (
	"backend/media-service/handlers"
	"backend/media-service/middleware"
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

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost", "https://collabhub.cloudpub.ru"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Статическая раздача файлов
	r.Static("/uploads", "./uploads")

	mediaHandler := &handlers.MediaHandler{}

	api := r.Group("/api/v1")
	{
		protected := api.Group("/")
		protected.Use(middleware.AuthRequired())
		{
			// Загрузка медиа
			protected.POST("/upload/image", mediaHandler.UploadImage)
			protected.POST("/upload/video", mediaHandler.UploadVideo)
			protected.POST("/upload/audio", mediaHandler.UploadAudio)
			protected.POST("/upload/file", mediaHandler.UploadFile)

			// Получение файла
			protected.GET("/media/:filename", mediaHandler.GetMedia)
		}
	}

	log.Println("Media Service running on :8088")
	if err := r.Run(":8088"); err != nil {
		log.Fatal("Failed to run server: ", err)
	}
}
