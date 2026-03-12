// backend/recommendation-service/main.go
package main

import (
	"backend/recommendation-service/db"
	"backend/recommendation-service/handlers"
	"backend/recommendation-service/middleware"
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("⚠️  Warning: .env file not found")
	}

	db.InitDB()

	// Инициализация handlers
	// trackingHandler := &handlers.TrackingHandler{DB: db.DB}
	recommendationHandler := &handlers.RecommendationHandler{DB: db.DB}

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost", "https://collabhub.cloudpub.ru"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Session-ID", "X-Device-Type", "X-Platform"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "healthy",
			"service": "recommendation-service",
			"version": "1.0.0",
		})
	})

	apiV1 := r.Group("/api/v1")
	{
		// === PUBLIC ENDPOINTS (БЕЗ АВТОРИЗАЦИИ) ===
		recommendations := apiV1.Group("/recommendations")
		{
			// ИЗМЕНЕНО: убрали AuthRequired
			recommendations.GET("/feed", recommendationHandler.GetPersonalizedFeed)
			recommendations.GET("/trending", recommendationHandler.GetTrending)
			recommendations.GET("/:content_type/:content_id/similar", recommendationHandler.GetSimilarContent)
		}

		// === TRACKING (опциональная авторизация) ===
		tracking := apiV1.Group("/tracking")
		{
			tracking.POST("/view", middleware.AuthOptional(), recommendationHandler.TrackView)
			tracking.POST("/interaction", middleware.AuthOptional(), recommendationHandler.TrackInteraction)
		}

		// === ADMIN (требуется авторизация) ===
		admin := apiV1.Group("/admin")
		admin.Use(middleware.AuthRequired(), middleware.AdminRequired())
		{
			admin.POST("/recalculate-preferences", recommendationHandler.RecalculateAllPreferences)
			admin.GET("/stats", recommendationHandler.GetStats)
			admin.POST("/test-system", func(c *gin.Context) {
				recommendationHandler.SystemTest()
				c.JSON(200, gin.H{"status": "test completed, check logs"})
			})
		}
	}

	// === CRON JOBS ===
	setupCronJobs(recommendationHandler)

	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("✅ Recommendation Service running on :8089")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("📊 Features:")
	log.Println("   • View Tracking")
	log.Println("   • Personalized Feed")
	log.Println("   • Collaborative Filtering")
	log.Println("   • Content-Based Recommendations")
	log.Println("   • Trending Content")
	log.Println("   • ML-Ready Interaction Logs")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("🔗 API: http://localhost:8089/api/v1")
	log.Println("💚 Health: http://localhost:8089/health")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	if err := r.Run(":8089"); err != nil {
		log.Fatal("Failed to run server: ", err)
	}
}

func setupCronJobs(handler *handlers.RecommendationHandler) {
	c := cron.New()

	// Обновляем trending scores каждые 5 минут
	c.AddFunc("*/5 * * * *", func() {
		log.Println("🔄 Running cron: Update trending scores")
		// Вызываем метод напрямую без gin.Context
		handler.UpdateTrendingScoresJob()
	})

	// Пересчитываем предпочтения пользователей каждый час
	c.AddFunc("0 * * * *", func() {
		log.Println("🔄 Running cron: Recalculate user preferences")
		handler.RecalculateAllPreferencesJob()
	})

	// Очищаем старые взаимодействия (старше 90 дней) каждую ночь
	c.AddFunc("0 3 * * *", func() {
		log.Println("🔄 Running cron: Cleanup old interactions")
		handler.CleanupOldInteractions()
	})

	c.Start()
	log.Println("⏰ Cron jobs started")
}
