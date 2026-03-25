// backend/video-service/db/db.go
package db

import (
	"backend/video-service/models"
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

	// Миграция моделей
	err = DB.AutoMigrate(
		&models.Video{},
		&models.VideoLike{},
		&models.VideoComment{},
		&models.ViewHistory{},
		&models.VideoPlaylist{},
		&models.Subscription{},
	)
	if err != nil {
		return nil, err
	}

	// Создаем таблицу для playlist_videos
	DB.Exec(`
        CREATE TABLE IF NOT EXISTS playlist_videos (
            video_playlist_id bigint NOT NULL,
            video_id bigint NOT NULL,
            PRIMARY KEY (video_playlist_id, video_id),
            FOREIGN KEY (video_playlist_id) REFERENCES video_playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        )
    `)

	log.Println("✅ Video Database migrated successfully")
	return DB, nil
}
