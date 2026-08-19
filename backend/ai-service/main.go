package main

import (
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// загрузка переменных окружения (для API_KEY)
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file, using environment variables")
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	aiHandler := 
	apiV1 := r.Group("/api/v1")
	{
		posts := apiV1.Group("/posts")
		{
			// Публичный роут, получение всех постов (Лента), без мидлвар
			posts.GET("/", postHandler.GetPost)

			// приватный роут, создание поста
			posts.POST("/", middlewares.AuthRequired(), postHandler.CreatePost)
		}
	}

	log.Println("Starting Posts service on :8081")
	if err := r.Run(":8081"); err != nil {
		log.Fatal("Failed to run server: ", err)
	}
}
