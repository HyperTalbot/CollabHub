// backend/messenger-service/models/conversation_participants.go
package models

import "time"

type ConversationParticipant struct {
	ConversationID    uint `gorm:"primaryKey"`
	UserID            uint `gorm:"primaryKey"`
	LastReadMessageID uint `gorm:"default:0"` // Курсор прочтения

	// GORM автоматически заполнит эти поля при создании/обновлении
	CreatedAt time.Time
	UpdatedAt time.Time

	JoinedAt time.Time `json:"joined_at"`
}

func (ConversationParticipant) TableName() string {
	return "conversation_participants"
}
