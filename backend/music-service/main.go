package main

import (
	"backend/music-service/db"
	"backend/music-service/handlers"
	"backend/music-service/middleware"
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Подключение к БД
	// dsn := os.Getenv("DATABASE_URL")
	// if dsn == "" {
	// 	dsn = "host=localhost user=postgres password=postgres dbname=collabhub_music port=5432 sslmode=disable"
	// }

	// db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	// if err != nil {
	// 	log.Fatal("Failed to connect to database:", err)
	// }

	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file")
	}

	db.InitDB()

	// Создаем тестовые данные
	// seedData(db)

	// Настройка Gin
	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Инициализация handlers
	trackHandler := &handlers.TrackHandler{DB: db.DB}
	playlistHandler := &handlers.PlaylistHandler{DB: db.DB}
	commentHandler := &handlers.CommentHandler{DB: db.DB}

	// API routes
	api := r.Group("/api/v1/music")
	{
		// Защищенные endpoints
		protected := api.Group("/")
		protected.Use(middleware.AuthRequired())
		{
			protected.POST("/tracks", trackHandler.CreateTrack)
			protected.POST("/tracks/:id/play", trackHandler.IncrementPlayCount)
		}

		// Публичные endpoints

		// Треки
		api.GET("/genres", trackHandler.GetGenres)
		api.GET("/quick-picks", trackHandler.GetQuickPicks)
		api.GET("/recommended", trackHandler.GetRecommendedTracks)
		api.GET("/tracks", trackHandler.GetTracks)
		api.GET("/tracks/:id", trackHandler.GetTrackByID)
		api.GET("/tracks/:id/similar", trackHandler.GetSimilarTracks)
		// api.POST("/tracks/:id/play", trackHandler.IncrementPlayCount)
		api.POST("/tracks/:id/like", trackHandler.LikeTrack)
		api.DELETE("/tracks/:id/like", trackHandler.UnlikeTrack)
		api.GET("/search", trackHandler.SearchTracks)

		// Плейлисты
		api.GET("/playlists/recommended", trackHandler.GetRecommendedPlaylists)
		api.GET("/playlists/:id", playlistHandler.GetPlaylistByID)
		api.GET("/playlists", playlistHandler.GetUserPlaylists)
		api.POST("/playlists", playlistHandler.CreatePlaylist)
		api.PUT("/playlists/:id", playlistHandler.UpdatePlaylist)
		api.DELETE("/playlists/:id", playlistHandler.DeletePlaylist)
		api.POST("/playlists/:id/tracks", playlistHandler.AddTrackToPlaylist)
		api.DELETE("/playlists/:id/tracks/:trackId", playlistHandler.RemoveTrackFromPlaylist)

		// Комментарии
		api.GET("/tracks/:id/comments", commentHandler.GetComments)
		api.POST("/tracks/:id/comments", commentHandler.CreateComment)
		api.DELETE("/comments/:id", commentHandler.DeleteComment)
	}

	// Запуск сервера
	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}

	log.Printf("Music service started on port %s", port)
	r.Run(":" + port)
}

// func seedData(db *gorm.DB) {
// 	// Проверяем, есть ли уже данные
// 	var count int64
// 	db.Model(&models.Track{}).Count(&count)
// 	if count > 0 {
// 		return
// 	}

// 	// Создаем тестовые треки
// 	tracks := []models.Track{
// 		{
// 			Title:       "Sunset Dreams",
// 			Artist:      "The Waves",
// 			Album:       "Ocean Vibes",
// 			Duration:    225,
// 			CoverURL:    "https://picsum.photos/seed/sunset/400",
// 			AudioURL:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
// 			Genre:       "Поп",
// 			ReleaseYear: 2024,
// 			PlayCount:   15420,
// 			LikesCount:  1230,
// 		},
// 		{
// 			Title:       "Electric Love",
// 			Artist:      "Neon Hearts",
// 			Album:       "Synth Wave",
// 			Duration:    252,
// 			CoverURL:    "https://picsum.photos/seed/electric/400",
// 			AudioURL:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
// 			Genre:       "Электроника",
// 			ReleaseYear: 2024,
// 			PlayCount:   12890,
// 			LikesCount:  980,
// 		},
// 		{
// 			Title:    "Midnight City",
// 			Artist:   "Urban Soul",
// 			Album:    "City Lights",
// 			Duration: 208,
// 			CoverURL: "https://picsum.photos/seed/midnight/400",

// 			AudioURL:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
// 			Genre:       "Инди",
// 			ReleaseYear: 2023,
// 			PlayCount:   18750,
// 			LikesCount:  1450,
// 		},
// 		{
// 			Title:       "Summer Vibes",
// 			Artist:      "Beach Boys Revival",
// 			Album:       "Tropical Mix",
// 			Duration:    235,
// 			CoverURL:    "https://picsum.photos/seed/summer/400",
// 			AudioURL:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
// 			Genre:       "Поп",
// 			ReleaseYear: 2024,
// 			PlayCount:   22100,
// 			LikesCount:  1890,
// 		},
// 		{
// 			Title:       "Rainy Day",
// 			Artist:      "Acoustic Dreams",
// 			Album:       "Calm Sessions",
// 			Duration:    243,
// 			CoverURL:    "https://picsum.photos/seed/rain/400",
// 			AudioURL:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
// 			Genre:       "Акустика",
// 			ReleaseYear: 2023,
// 			PlayCount:   9540,
// 			LikesCount:  720,
// 		},
// 		{
// 			Title:       "Dance Floor",
// 			Artist:      "DJ Pulse",
// 			Album:       "Club Nights",
// 			Duration:    198,
// 			CoverURL:    "https://picsum.photos/seed/dance/400",
// 			AudioURL:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
// 			Genre:       "Электроника",
// 			ReleaseYear: 2024,
// 			PlayCount:   31200,
// 			LikesCount:  2450,
// 		},
// 		{
// 			Title:       "Mountain High",
// 			Artist:      "Echo Valley",
// 			Album:       "Nature Sounds",
// 			Duration:    267,
// 			CoverURL:    "https://picsum.photos/seed/mountain/400",
// 			AudioURL:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
// 			Genre:       "Рок",
// 			ReleaseYear: 2023,
// 			PlayCount:   14300,
// 			LikesCount:  1100,
// 		},
// 		{
// 			Title:       "Jazz Night",
// 			Artist:      "The Blue Notes",
// 			Album:       "Smooth Sessions",
// 			Duration:    289,
// 			CoverURL:    "https://picsum.photos/seed/jazz/400",
// 			AudioURL:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
// 			Genre:       "Джаз",
// 			ReleaseYear: 2024,
// 			PlayCount:   8900,
// 			LikesCount:  670,
// 		},
// 		{
// 			Title:       "Hip Hop Chronicles",
// 			Artist:      "MC Flow",
// 			Album:       "Street Stories",
// 			Duration:    213,
// 			CoverURL:    "https://picsum.photos/seed/hiphop/400",
// 			AudioURL:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
// 			Genre:       "Хип-хоп",
// 			ReleaseYear: 2024,
// 			PlayCount:   27800,
// 			LikesCount:  2100,
// 		},
// 		{
// 			Title:       "Classical Morning",
// 			Artist:      "Symphony Orchestra",
// 			Album:       "Masterpieces",
// 			Duration:    342,
// 			CoverURL:    "https://picsum.photos/seed/classical/400",
// 			AudioURL:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
// 			Genre:       "Классика",
// 			ReleaseYear: 2023,
// 			PlayCount:   6700,
// 			LikesCount:  520,
// 		},
// 	}

// 	for _, track := range tracks {
// 		db.Create(&track)
// 	}

// 	// Создаем тестовые плейлисты
// 	playlists := []models.Playlist{
// 		{
// 			Name:        "Топ 50 - Россия",
// 			Description: "Самые популярные треки недели",
// 			CoverURL:    "https://picsum.photos/seed/top50/400",
// 			UserID:      1,
// 			IsPublic:    true,
// 		},
// 		{
// 			Name:        "Chill Vibes",
// 			Description: "Расслабляющая музыка для работы",
// 			CoverURL:    "https://picsum.photos/seed/chill/400",
// 			UserID:      1,
// 			IsPublic:    true,
// 		},
// 		{
// 			Name:        "Workout Mix",
// 			Description: "Энергичная музыка для тренировок",
// 			CoverURL:    "https://picsum.photos/seed/workout/400",
// 			UserID:      1,
// 			IsPublic:    true,
// 		},
// 		{
// 			Name:        "Ретро 80-90s",
// 			Description: "Хиты из прошлого",
// 			CoverURL:    "https://picsum.photos/seed/retro/400",
// 			UserID:      1,
// 			IsPublic:    true,
// 		},
// 	}

// 	for _, playlist := range playlists {
// 		db.Create(&playlist)
// 	}

// 	log.Println("Test data created successfully")
// }
