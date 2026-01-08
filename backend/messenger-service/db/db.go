// package db

// import (
// 	"backend/messenger-service/models"

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

// 	// 1. Сначала создаем User, так как на него ссылаются все
// 	err = DB.AutoMigrate(&models.User{})
// 	if err != nil {
// 		log.Fatal("Migration failed (User): ", err)
// 	}

// 	// 2. Создаем Сервера (они зависят от User, но не от Каналов)
// 	err = DB.AutoMigrate(&models.Server{})
// 	if err != nil {
// 		log.Fatal("Migration failed (Server): ", err)
// 	}

// 	// 3. Создаем Каналы (они зависят от Серверов)
// 	// Теперь ошибки не будет, так как таблица servers уже существует
// 	err = DB.AutoMigrate(&models.Channel{})
// 	if err != nil {
// 		log.Fatal("Migration failed (Channel): ", err)
// 	}

// 	// Авто миграция: создание всех таблиц
// 	err = DB.AutoMigrate(
// 		&models.Conversation{},
// 		&models.Message{},
// 		&models.ConversationParticipant{},
// 		&models.Channel{},
// 		&models.Server{},
// 		&models.Group{},
// 		&models.GroupMember{},
// 		&models.Call{},
// 		&models.ScreenShare{},
// 	)
// 	if err != nil {
// 		log.Fatal("Migration failed (Others): ", err)
// 	}

// 	log.Println("✅ Messenger Database migrated successfully")
// }

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
	var err error
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set in .env file")
	}

	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
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
