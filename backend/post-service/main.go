package main

import (
	"backend/post-service/db"
	"backend/post-service/handlers"
	"backend/post-service/middlewares"
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file, using environment variables")
	}

	db.InitDB()
	postHandler := handlers.NewPostHandler(db.DB)
	commentHandler := handlers.NewCommentHandler(db.DB)

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	apiV1 := r.Group("/api/v1")
	{
		posts := apiV1.Group("/posts")
		{
			// Публичный роут, получение всех постов (Лента), без мидлвар
			// posts.GET("/", postHandler.GetPost)
			posts.GET("/", middlewares.AuthOptional(), postHandler.GetPosts)

			// приватный роут, создание поста
			posts.POST("/", middlewares.AuthRequired(), postHandler.CreatePost)

			// Получение одного поста по ID
			posts.GET("/:id", postHandler.GetPostByID)

			// :id это placeholder для ID поста
			// лайк поста
			posts.POST("/:id/like", middlewares.AuthRequired(), postHandler.LikePost)

			// убрать лайк
			posts.DELETE("/:id/like", middlewares.AuthRequired(), postHandler.UnlikePost)

			// Получить комментарии к посту (GET .../posts/4/comments)
			posts.GET("/:id/comments", middlewares.AuthOptional(), commentHandler.GetCommentsByPost)

			// Создать комментарий к посту (POST .../posts/4/comments)
			posts.POST("/:id/comments", middlewares.AuthRequired(), commentHandler.CreateComment)
		}

		comments := apiV1.Group("/comments")

		comments.Use(middlewares.AuthRequired())
		{
			// :id здесь - это ID комментария
			comments.POST("/:id/like", commentHandler.LikeComment)
			comments.DELETE("/:id/like", commentHandler.UnlikeComment)
		}

	}

	log.Println("Starting Posts service on :8081")
	if err := r.Run(":8081"); err != nil {
		log.Fatal("Failed to run server: ", err)
	}
}
