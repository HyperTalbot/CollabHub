package models

import (
	"time"
)

type InteractionType string

const (
	InteractionView    InteractionType = "view"
	InteractionLike    InteractionType = "like"
	InteractionComment InteractionType = "comment"
	InteractionShare   InteractionType = "share"
	InteractionSkip    InteractionType = "skip"
	InteractionSearch  InteractionType = "search"
)

// Interaction - История взаимодействий для ML
type Interaction struct {
	ID              uint        `gorm:"primaryKey" json:"id"`
	UserID          uint        `gorm:"not null;index" json:"user_id"`
	ContentType     ContentType `gorm:"not null" json:"content_type"`
	ContentID       uint        `gorm:"not null" json:"content_id"`
	InteractionType string      `gorm:"not null" json:"interaction_type"` // like, comment, share

	// Контекст
	SessionID  string `gorm:"index" json:"session_id"` // Для группировки сессий
	DeviceType string `json:"device_type"`             // mobile, desktop, tablet
	Platform   string `json:"platform"`                // web, ios, android

	// Дополнительные данные
	Metadata *string `gorm:"type:jsonb;default:null" json:"metadata"` // JSON с доп. данными

	CreatedAt time.Time `json:"created_at"`
}

func (Interaction) TableName() string {
	return "interactions"
}
