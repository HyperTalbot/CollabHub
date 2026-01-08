// backend/messenger-service/models/conversation.go
package models

import (
	"time"
)

// --- USER ---
type User struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

// --- ЛИЧНЫЕ ЧАТЫ (DM) ---
type Conversation struct {
	ID uint `gorm:"primaryKey" json:"id"`
	// Type убрали, так как это всегда DM

	Participants []User `gorm:"many2many:conversation_participants;" json:"participants"`

	// Виртуальные поля для API (gorm:"-" означает "не искать в базе данных")
	LastMessageContent  string    `gorm:"-" json:"last_message_content"`
	LastMessageAt       time.Time `gorm:"-" json:"last_message_at"`
	LastMessageSenderID uint      `gorm:"-" json:"last_message_sender_id"`
	UnreadCount         int       `gorm:"-" json:"unread_count"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// // --- MESSAGE ---
// type Message struct {
//  ID             uint      `gorm:"primaryKey" json:"id"`
//  SenderID       uint      `json:"sender_id"`
//  Sender         User      `gorm:"foreignKey:SenderID" json:"sender"`

//  Content        string    `gorm:"type:text" json:"content"`

//  // Ссылки (или ЛС, или Группа)
//  ConversationID *uint     `gorm:"index" json:"conversation_id,omitempty" `
//  GroupID        *uint     `gorm:"index" json:"group_id,omitempty"`

//  ReplyToID      *uint     `json:"reply_to_id"`
//  IsPinned       bool      `gorm:"default:false" json:"is_pinned"`
//  IsEdited       bool      `gorm:"default:false" json:"is_edited"`

//  CreatedAt      time.Time `json:"created_at"`
//  UpdatedAt      time.Time `json:"updated_at"`
//  DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
// }

// package models

// import (
// 	"time"

// 	"gorm.io/gorm"
// )

// type ConversationType string

// const (
// 	ConversationTypeDM    ConversationType = "dm"    // Личный чат
// 	ConversationTypeGroup ConversationType = "group" // Группа
// )

// type Conversation struct {
// 	ID uint `gorm:"primaryKey" json:"id"`
// 	// Type ConversationType `gorm:"default:'dm'"` // <-- Тип чата

// 	// Поля для Группы:
// 	// Name      string // Имя группы (пусто для DM)
// 	// AvatarURL string // Аватарка группы
// 	// OwnerID   uint   // Создатель группы (важно для прав)

// 	// Связи
// 	// Участники этого чата (связь многие ко многим)
// 	Participants []User `gorm:"many2many:conversation_participants;" json:"participants"`

// 	// Сообщения в этом чате (связь один ко многим)
// 	// Messages []Message `gorm:"foreignKey:ConversationID" json:"messages"`

// 	// (Опционально) Поле для последнего сообщения (для превью в списке чатов)
// 	// LastMessageID *uint `json:"last_message_id,omitempty"`

// 	// --- Виртуальные поля для списка чатов ---
// 	// LastMessageContent  string    `gorm:"-" json:"last_message_content"`
// 	// LastMessageAt       time.Time `gorm:"-" json:"last_message_at"`
// 	// LastMessageSenderID uint      `gorm:"-" json:"last_message_sender_id"` // Чтобы фронт писал "Вы: "
// 	// UnreadCount         int       `gorm:"-" json:"unread_count"`

// 	CreatedAt time.Time      `json:"created_at"`
// 	UpdatedAt time.Time      `json:"updated_at"`
// 	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
// }

// // --- ГРУППЫ ---
// type Group struct {
// 	ID          uint   `gorm:"primaryKey" json:"id"`
// 	Name        string `gorm:"size:100;not null" json:"name"`
// 	Description string `json:"description"`
// 	AvatarURL   string `json:"avatar_url"`

// 	OwnerID uint `gorm:"not null" json:"owner_id"` // Владелец
// 	Owner   User `gorm:"foreignKey:OwnerID" json:"-"`

// 	// Участники группы (связь через таблицу group_members)
// 	Members []GroupMember `json:"members"`

// 	CreatedAt time.Time `json:"created_at"`
// 	UpdatedAt time.Time `json:"updated_at"`
// }

// // Таблица связей участников группы с ролями
// type GroupMember struct {
// 	GroupID  uint      `gorm:"primaryKey" json:"group_id"`
// 	UserID   uint      `gorm:"primaryKey" json:"user_id"`
// 	Role     string    `gorm:"default:'member'" json:"role"` // 'admin', 'member'
// 	JoinedAt time.Time `json:"joined_at"`

// 	User User `gorm:"foreignKey:UserID" json:"user"`
// }

// type User struct {
// 	ID       uint   `gorm:"primaryKey" json:"id"`
// 	Username string `json:"username"` // (временная заглушка)
// }

// // conversation_participants - это промежуточная таблица для GORM
