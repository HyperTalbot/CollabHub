package models

import (
	"time"

	"gorm.io/gorm"
)

type Conversation struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// Участники этого чата (связь многие ко многим)
	Participants []User `gorm:"many2many:conversation_participants;" json:"participants"`

	// Сообщения в этом чате (связь один ко многим)
	Messages []Message `gorm:"foreignKey:ConversationID" json:"messages"`

	// (Опционально) Поле для последнего сообщения (для превью в списке чатов)
	LastMessageID *uint `json:"last_message_id,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type User struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Username string `json:"username"` // (временная заглушка)
}

// conversation_participants - это промежуточная таблица для GORM
