package models

import "time"

type ConversationParticipant struct {
	ConversationID    uint `gorm:"primaryKey"`
	UserID            uint `gorm:"primaryKey"`
	LastReadMessageID uint `gorm:"default:0"` // <-- Курсор прочтения
	CreateAt          time.Time
	UpdatedAt         time.Time
}

// Переопределим имя таблицы, чтобы GORM использовал старую таблицу, если она есть,
// или создал новую правильно.
func (ConversationParticipant) TableName() string {
	return "conversation_participants"
}
