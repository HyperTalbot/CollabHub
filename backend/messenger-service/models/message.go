package models

import (
	"time"

	"gorm.io/gorm"
)

type Message struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	ConversationID uint   `gorm:"not null;index" json:"conversation_id"`
	SenderID       uint   `gorm:"not null;index" json:"sender_id"`
	Content        string `gorm:"type:text;not null" json:"content"`

	// (опционально) Статус прочтения
	IsRead bool `gorm:"default:false" json:"is_read"`

	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
