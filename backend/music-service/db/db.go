// backend/music-service/db/db.go
package db

import (
	"backend/music-service/models"
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() (*gorm.DB, error) {
	var err error
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL not set")
	}

	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	log.Println("Database connected. Starting migration...")

	// Миграция всех моделей
	err = DB.AutoMigrate(
		&models.Track{},
		&models.Playlist{},
		&models.Tag{},
		&models.TrackLike{},
		&models.ListeningHistory{},
		&models.Comment{},
	)
	if err != nil {
		return nil, err
	}

	// ДОБАВЛЕНО: Создаем таблицу для связи many-to-many
	DB.Exec(`
    CREATE TABLE IF NOT EXISTS track_tags (
      track_id bigint NOT NULL,
      tag_id bigint NOT NULL,
      PRIMARY KEY (track_id, tag_id),
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `)

	log.Println("✅ Music Database migrated successfully")
	return DB, nil
}

// package db

// import (
// 	"backend/music-service/models"
// 	"log"
// 	"os"

// 	"gorm.io/driver/postgres"
// 	"gorm.io/gorm"
// )

// var DB *gorm.DB

// func InitDB() {
// 	var err error
// 	dsn := os.Getenv("DATABASE_URL")
// 	if dsn == "" {
// 		log.Fatal("DATABASE_URL not set in .env file")
// 	}

// 	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
// 	if err != nil {
// 		log.Fatal("Failed to connect to database: ", err)
// 	}

// 	log.Println("Database connected. Starting migration...")

// 	// === УМНАЯ МИГРАЦИЯ ===
// 	// Порядок важен! Сначала создаем независимые таблицы, потом зависимые.

// 	// 1. Сначала создаем Track (независимая таблица)
// 	err = DB.AutoMigrate(&models.Track{})
// 	if err != nil {
// 		log.Fatal("Migration failed (Track): ", err)
// 	}

// 	// 2. Создаем Playlist (зависит только от user_id, но не требует FK в простой версии)
// 	err = DB.AutoMigrate(&models.Playlist{})
// 	if err != nil {
// 		log.Fatal("Migration failed (Playlist): ", err)
// 	}

// 	// 3. Создаем связующие и зависимые таблицы
// 	err = DB.AutoMigrate(
// 		&models.Track{},
// 		&models.TrackLike{},        // Зависит от Track
// 		&models.ListeningHistory{}, // Зависит от Track
// 		&models.Comment{},          // Зависит от Track
// 		&models.Playlist{},
// 		&models.Tag{},
// 	)
// 	if err != nil {
// 		log.Fatal("Migration failed (Related tables): ", err)
// 	}

// 	log.Println("✅ Music Database migrated successfully")

// 	// Создаем тестовые данные если БД пустая
// 	// seedData()
// }

// func seedData() {
// 	var count int64
// 	DB.Model(&models.Track{}).Count(&count)
// 	if count > 0 {
// 		log.Println("Database already contains data, skipping seed...")
// 		return
// 	}

// 	log.Println("Seeding database with test data...")

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
// 			Title:       "Midnight City",
// 			Artist:      "Urban Soul",
// 			Album:       "City Lights",
// 			Duration:    208,
// 			CoverURL:    "https://picsum.photos/seed/midnight/400",
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
// 		DB.Create(&track)
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
// 		DB.Create(&playlist)
// 	}

// 	log.Println("✅ Test data seeded successfully")
// }
