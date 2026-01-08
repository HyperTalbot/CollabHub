// backend/messenger-service/models/group.go
package models

import (
	"time"

	"gorm.io/gorm"
)

// --- ГРУППЫ ---
type Group struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Name        string `gorm:"size:100;not null" json:"name"`
	Description string `json:"description"`
	AvatarURL   string `json:"avatar_url"`

	OwnerID uint `gorm:"not null" json:"owner_id"`
	Owner   User `gorm:"foreignKey:OwnerID" json:"-"`

	Members []GroupMember `json:"members"`

	// Те же виртуальные поля для списка групп
	LastMessageContent  string    `gorm:"-" json:"last_message_content"`
	LastMessageAt       time.Time `gorm:"-" json:"last_message_at"`
	LastMessageSenderID uint      `gorm:"-" json:"last_message_sender_id"`
	UnreadCount         int       `gorm:"-" json:"unread_count"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// Таблица участников группы
type GroupMember struct {
	GroupID  uint      `gorm:"primaryKey" json:"group_id"`
	UserID   uint      `gorm:"primaryKey" json:"user_id"`
	Role     string    `gorm:"default:'member'" json:"role"` // 'owner', 'admin', 'member'
	JoinedAt time.Time `json:"joined_at"`

	User User `gorm:"foreignKey:UserID" json:"user"`
}
