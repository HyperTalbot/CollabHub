// backend/recommendation-service/db/db.go
package db

import (
	"backend/recommendation-service/models"
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
	)

	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: newLogger,
	})

	if err != nil {
		log.Fatal("❌ Failed to connect to database:", err)
	}

	log.Println("✅ Database connected")

	// Автомиграция
	if err := DB.AutoMigrate(
		&models.View{},
		&models.Interaction{},
		&models.UserPreference{},
		&models.TrendingContent{},
		&models.ContentMetadata{}, // ДОБАВЛЕНО
	); err != nil {
		log.Fatal("❌ Migration failed:", err)
	}

	// Создаем составной уникальный индекс для views
	DB.Exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_view 
        ON views(user_id, content_type, content_id) 
        WHERE deleted_at IS NULL
    `)

	// Создаем составной индекс для content_metadata
	DB.Exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_content_meta 
        ON content_metadata(content_type, content_id)
    `)

	log.Println("✅ Migrations completed")
}
