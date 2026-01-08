// backend/messenger-service/models/reaction.go
package models

import (
	"time"
)

// UserStatus - Статусы пользователей
type UserStatus struct {
	UserID       uint      `gorm:"primaryKey" json:"user_id"`
	Status       string    `gorm:"default:'offline'" json:"status"` // online, offline, away, dnd
	CustomStatus string    `json:"custom_status"`                   // "На встрече", "Играю в игру" и т.д.
	LastSeenAt   time.Time `json:"last_seen_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UserBlock - Блокировка пользователей
type UserBlock struct {
	ID        uint `gorm:"primaryKey" json:"id"`
	BlockerID uint `gorm:"not null;index" json:"blocker_id"` // Кто заблокировал
	BlockedID uint `gorm:"not null;index" json:"blocked_id"` // Кого заблокировали

	CreatedAt time.Time `json:"created_at"`
}
