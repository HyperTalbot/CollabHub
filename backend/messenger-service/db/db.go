// backend/messenger-service/db/db.go
package db

import (
	"backend/messenger-service/models"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	// УЛУЧШЕНО: Более детальное логирование
	// newLogger := logger.New(
	// 	log.New(os.Stdout, "\r\n", log.LstdFlags),
	// 	logger.Config{
	// 		LogLevel:                  logger.Info, // Показываем все SQL запросы
	// 		IgnoreRecordNotFoundError: true,
	// 		Colorful:                  true,
	// 	},
	// )

	var err error
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set in .env file")
	}

	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		// Logger: newLogger,
	})
	if err != nil {
		log.Fatal("Failed to connect to database: ", err)
	}

	log.Println("Database connected. Starting migration...")

	// ПРАВИЛЬНЫЙ ПОРЯДОК МИГРАЦИЙ:
	// 1. Независимые таблицы
	err = DB.AutoMigrate(
		&models.User{},
		&models.UserStatus{},
		&models.UserBlock{},
		&models.NotificationSettings{},
		&models.Friendship{},
	)
	if err != nil {
		log.Fatal("Migration failed (Users): ", err)
	}

	// 2. Серверы и группы
	err = DB.AutoMigrate(
		&models.Server{},
		&models.Group{},
		&models.Conversation{},
	)
	if err != nil {
		log.Fatal("Migration failed (Servers/Groups): ", err)
	}

	// 3. Зависимые таблицы
	err = DB.AutoMigrate(
		&models.Channel{},
		&models.ServerRole{},
		&models.ServerMemberRole{},
		&models.ServerInvite{},
		&models.GroupMember{},
		&models.ConversationParticipant{},
		&models.ChannelFolder{}, // НОВОЕ: папки каналов
		&models.ServerInvitation{},
	)
	if err != nil {
		log.Fatal("Migration failed (Relations): ", err)
	}

	// 4. Сообщения и связанное
	err = DB.AutoMigrate(
		&models.Message{},
		&models.MessageReaction{},
		&models.PinnedMessage{},
	)
	if err != nil {
		log.Fatal("Migration failed (Messages): ", err)
	}

	// 5. Звонки
	err = DB.AutoMigrate(
		&models.Call{},
		&models.ScreenShare{},
	)
	if err != nil {
		log.Fatal("Migration failed (Calls): ", err)
	}

	// 6. Опросы и стикеры
	err = DB.AutoMigrate(
		&models.StickerPack{},
		&models.Sticker{},
		&models.Poll{},
		&models.PollOption{},
		&models.PollVote{},
	)
	if err != nil {
		log.Fatal("Migration failed (Polls/Stickers): ", err)
	}

	log.Println("✅ Messenger Database migrated successfully")
}
