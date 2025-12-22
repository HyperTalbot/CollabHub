package models

import (
	"time"

	"gorm.io/gorm"
)

type Message struct {
	ID uint `gorm:"primaryKey" json:"id"`
	// БЫЛО: *uint, СТАЛО: uint (без звездочки, так как чат обязателен)
	ConversationID uint   `gorm:"not null;index" json:"conversation_id"`
	ChannelID      *uint  `gorm:"channel_id,omitempty"`
	SenderID       uint   `gorm:"not null;index" json:"sender_id"`
	Sender         User   `gorm:"foreignKey:SenderID" json:"sender"`
	Content        string `gorm:"type:text;not null" json:"content"`

	IsRead        bool  `gorm:"default:false" json:"is_read"`   // (опционально) Статус прочтения
	IsPinned      bool  `gorm:"default:false" json:"is_pinned"` // Закреплено ли сообщение
	IsEdited      bool  `gorm:"default:false" json:"is_edited"` // Было ли отредактировано
	ReplyToID     *uint `json:"reply_to_id"`                    // ID сообщения, на которое отвечаем (может быть null)
	ForwardedFrom *uint `json:"forwarded_from"`                 // ID пользователя, от которого переслали (опционально)

	AttachmentURL  string
	AttachmentType string // audio | image | video | file

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
