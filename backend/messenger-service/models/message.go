// backend/messenger-service/models/message.go
package models

import (
	"errors"
	"time"

	"github.com/lib/pq" // ВАЖНО
	"gorm.io/gorm"
)

type Message struct {
	ID uint `gorm:"primaryKey" json:"id"`
	// БЫЛО: *uint, СТАЛО: uint (без звездочки, так как чат обязателен)
	ConversationID *uint `gorm:"index" json:"conversation_id"`
	GroupID        *uint `gorm:"index" json:"group_id,omitempty"`
	ChannelID      *uint `gorm:"index" json:"channel_id,omitempty"`

	SenderID uint `gorm:"not null;index" json:"sender_id"`
	Sender   User `gorm:"foreignKey:SenderID" json:"sender"`

	Content string `gorm:"type:text;not null" json:"content"`

	// ─── Виртуальные поля (не хранятся в БД, заполняются в хендлерах) ───
	SenderUsername    string         `gorm:"-" json:"sender_username,omitempty"`
	SenderAvatar      string         `gorm:"-" json:"sender_avatar,omitempty"`
	ForwardedFromName string         `gorm:"-" json:"forwarded_from_name,omitempty"`
	ReplyPreview      *ReplyPreview  `gorm:"-" json:"reply_preview,omitempty"`
	ReplyPreviews     []ReplyPreview `gorm:"-" json:"reply_previews,omitempty"` // превью всех сообщений из reply_to_ids
	// НОВОЕ: прочитано ли сообщение получателем (для галочек ✓ / ✓✓).
	// DM: last_read собеседника >= ID сообщения.
	// Группа: МИНИМУМ last_read среди остальных участников >= ID (прочитали все).
	IsReadByRecipient bool `gorm:"-" json:"is_read_by_recipient"`

	// Системное сообщение (звонок, событие и т.д.)
	IsSystemMessage bool    `gorm:"default:false" json:"is_system_message"`
	SystemType      string  `json:"system_type,omitempty"`                   // "call", "event"
	SystemData      *string `gorm:"type:jsonb" json:"system_data,omitempty"` // УКАЗАТЕЛЬ

	IsRead        bool   `gorm:"default:false" json:"is_read"`            // (опционально) Статус прочтения
	IsPinned      bool   `gorm:"default:false" json:"is_pinned"`          // Закреплено ли сообщение
	IsEdited      bool   `gorm:"default:false" json:"is_edited"`          // Было ли отредактировано
	ReplyToID     *uint  `json:"reply_to_id"`                             // ID сообщения, на которое отвечаем (может быть null)
	ReplyToIDs    string `gorm:"type:text" json:"reply_to_ids,omitempty"` // ответ на НЕСКОЛЬКО сообщений (мультивыбор) — CSV "12,15,19".
	ForwardedFrom *uint  `json:"forwarded_from"`                          // ID пользователя, от которого переслали (опционально)

	AttachmentURL  string `json:"attachment_url,omitempty"`
	AttachmentType string `json:"attachment_type,omitempty"` // audio | image | video | file

	// Новые поля
	Mentions  pq.Int64Array `gorm:"type:integer[]" json:"mentions"` // ID упомянутых пользователей
	StickerID *uint         `json:"sticker_id,omitempty"`           // Если это стикер
	PollID    *uint         `json:"poll_id,omitempty"`              // Если это опрос

	Reactions []MessageReaction `gorm:"foreignKey:MessageID" json:"reactions,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// MessageReaction - Реакции на сообщения
type MessageReaction struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	MessageID uint   `gorm:"not null;index" json:"message_id"`
	UserID    uint   `gorm:"not null" json:"user_id"`
	Emoji     string `gorm:"not null" json:"emoji"` // 👍, ❤️, 😂 и т.д.

	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// // PinnedMessage - Закрепленные сообщения
// type PinnedMessage struct {
// 	ID             uint  `gorm:"primaryKey" json:"id"`
// 	MessageID      uint  `gorm:"not null;uniqueIndex:idx_pinned_message" json:"message_id"`
// 	ConversationID *uint `gorm:"index" json:"conversation_id,omitempty"`
// 	ChannelID      *uint `gorm:"index" json:"channel_id,omitempty"`
// 	GroupID        *uint `gorm:"index" json:"group_id,omitempty"`
// 	PinnedByUserID uint  `gorm:"not null" json:"pinned_by_user_id"`

// 	Message  Message   `gorm:"foreignKey:MessageID" json:"message"`
// 	PinnedAt time.Time `json:"pinned_at"`
// }

// PinnedMessage - Закреплённые сообщения
type PinnedMessage struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	MessageID      uint           `gorm:"not null;index" json:"message_id"`
	ConversationID *uint          `gorm:"index" json:"conversation_id,omitempty"`
	GroupID        *uint          `gorm:"index" json:"group_id,omitempty"`
	ChannelID      *uint          `gorm:"index" json:"channel_id,omitempty"`
	PinnedByUserID uint           `gorm:"not null" json:"pinned_by_user_id"`
	PinnedAt       time.Time      `json:"pinned_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// ReplyPreview — превью сообщения, на которое был ответ (чтобы фронт показывал
// блок ответа даже если оригинал не загружен в историю)
type ReplyPreview struct {
	ID             uint   `json:"id"`
	Content        string `json:"content"`
	SenderID       uint   `json:"sender_id"`
	SenderUsername string `json:"sender_username"`
	AttachmentType string `json:"attachment_type,omitempty"`
}

func (m *Message) BeforeCreate(tx *gorm.DB) error {
	// Проверяем, что хотя бы один ID заполнен
	if m.ConversationID == nil && m.GroupID == nil && m.ChannelID == nil {
		return errors.New("message must belong to conversation, group or channel")
	}
	return nil
}
