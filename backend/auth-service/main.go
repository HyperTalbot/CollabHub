package main

import (
	"backend/auth-service/db"
	"backend/auth-service/handlers"
	"backend/auth-service/middleware"
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Загружаем .env
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file, using environment variables")
	}

	// Инициализация БД (подключение + миграция)
	db.InitDB()

	// Создаем обработчик AuthHandler, передавая ему подключение к БД
	authHandler := handlers.NewAuthHandler(db.DB)
	userHandler := handlers.UserHandler{DB: db.DB}

	// Инициализируем роутер Gin
	r := gin.Default()

	// Должно быть до регистрации роутов
	r.Use(cors.New(cors.Config{
		// Указываем к каким адресам (ориджинам) даем доступ
		AllowOrigins: []string{"http://localhost:3000", "http://localhost", "https://collabhub.cloudpub.ru"},

		// Указываем метода HTTP
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},

		// Указываем заголовки
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},

		// Разрешаем куки (если понадобиться в будущем)
		AllowCredentials: true,

		// Время жизни pre-flight запроса
		MaxAge: 12 * time.Hour,
	}))

	// Группируем роуты для v1
	apiV1 := r.Group("/api/v1")
	{
		auth := apiV1.Group("/auth")
		{
			// Регистрируем наш эндпоинт
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)

			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)
		}

		// --- 2. ПУБЛИЧНЫЕ/ВНУТРЕННИЕ роуты пользователей ---
		// (Используются сервисом 'post-service')
		users := apiV1.Group("/users")
		{
			users.GET("/:id", userHandler.GetUserByID)
			users.GET("/search", userHandler.SearchUsers)
		}

		// 3. ЗАЩИЩЕННЫЕ роуты (Для всех залогиненных)
		protected := apiV1.Group("/")
		protected.Use(middleware.AuthRequired())
		{
			protected.GET("/users/me", authHandler.GetMe)
			protected.PUT("/users/me", authHandler.UpdateProfile)
			protected.POST("/auth/change-password", authHandler.ChangePassword)
		}

		// 4. АДМИНСКИЕ роуты (Только для админов)
		admin := apiV1.Group("/admin")
		// Сначала проверяем токен, потом проверяем роль
		admin.Use(middleware.AuthRequired(), middleware.AdminRequired())
		{
			admin.GET("/users", userHandler.GetAllUsers)
			admin.PATCH("/users/:id/role", userHandler.UpdateUserRole)
			admin.PUT("/users/:id", userHandler.AdminUpdateUser)
			admin.DELETE("/users/:id", userHandler.DeleteUser)
		}
	}

	// Запускаем наш сервер
	log.Println("Starting server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to run server: ", err)
	}
}
