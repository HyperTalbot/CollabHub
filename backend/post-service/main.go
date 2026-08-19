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
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost", "https://collabhub.cloudpub.ru"},
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
			posts.GET("/:id", middlewares.AuthOptional(), postHandler.GetPostByID)

			// Получить посты по списку ID (для рекомендаций)
			posts.GET("/by-ids", middlewares.AuthOptional(), postHandler.GetPostsByIDs)

			// :id это placeholder для ID поста
			// лайк поста
			posts.POST("/:id/like", middlewares.AuthRequired(), postHandler.LikePost)

			// убрать лайк
			posts.DELETE("/:id/like", middlewares.AuthRequired(), postHandler.UnlikePost)

			// Получить комментарии к посту (GET .../posts/4/comments)
			posts.GET("/:id/comments", middlewares.AuthOptional(), commentHandler.GetCommentsByPost)

			// Создать комментарий к посту (POST .../posts/4/comments)
			posts.POST("/:id/comments", middlewares.AuthRequired(), commentHandler.CreateComment)

			// алиас роута ветки комментария внутри группы /posts.
			// Нужен, потому что внешний прокси (production) пропускает только
			// /api/v1/posts/*, а /api/v1/comments/* возвращал 404.
			// Конфликтов нет: "/comment-thread/:id" — два сегмента, "/:id" — один.
			posts.GET("/comment-thread/:id", middlewares.AuthOptional(), commentHandler.GetCommentThread)
		}

		comments := apiV1.Group("/comments")
		{
			// comments.Use(middlewares.AuthRequired())
			// :id здесь - это ID комментария
			comments.POST("/:id/like", middlewares.AuthRequired(), commentHandler.LikeComment)
			comments.DELETE("/:id/like", middlewares.AuthRequired(), commentHandler.UnlikeComment)

			// Получение ветки публичный/опциональный роут
			// Используем AuthOptional, чтобы он мог обогатить "is_liked_by_me", если пользователь залогинен
			comments.GET("/:id/thread", middlewares.AuthOptional(), commentHandler.GetCommentThread)
		}

		admin := apiV1.Group("/admin")
		// ВАЖНО: Используем ДВА middleware
		admin.Use(middlewares.AuthRequired(), middlewares.AdminRequired())
		{
			admin.GET("/posts", postHandler.AdminGetAllPosts)
			admin.DELETE("/posts/:id", postHandler.AdminDeletePost)

			// Заглушки для будущего функционала
			admin.GET("/videos", postHandler.AdminGetVideos)
			admin.GET("/shorts", postHandler.AdminGetShorts)
			admin.GET("/music", postHandler.AdminGetMusic)
			admin.GET("/streams", postHandler.AdminGetStreams)
		}
	}

	// apiV1.POST("/uploads", middlewares.AuthRequired(), handlers.UploadImage)

	log.Println("Starting Posts service on :8084")
	if err := r.Run(":8084"); err != nil {
		log.Fatal("Failed to run server: ", err)
	}
}
