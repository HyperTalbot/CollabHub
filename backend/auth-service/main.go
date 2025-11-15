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

	// Инициализируем роутер Gin
	r := gin.Default()

	// Должно быть до регистрации роутов
	r.Use(cors.New(cors.Config{
		// Указываем к каким адресам (ориджинам) даем доступ
		AllowOrigins: []string{"http://localhost:3000"},

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
		}

		// (Здесь мы добавим /users/me)
		users := apiV1.Group("/users")
		// Применяем мидлвар AuthRequired ко всем роутам в этой группе

		users.Use(middleware.AuthRequired())
		{
			users.GET("/me", authHandler.GetMe)
			// users.PUT("/me", authHandler.UpdateProfile) // Будущий роут
		}
	}

	// Запускаем наш сервер
	log.Println("Starting server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to run server: ", err)
	}
}
