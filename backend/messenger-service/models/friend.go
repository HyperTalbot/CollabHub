package models

import (
	"time"

	"gorm.io/gorm"
)

type FriendshipStatus string

const (
	FriendshipPending  FriendshipStatus = "pending"
	FriendshipAccepted FriendshipStatus = "accepted"
	FriendshipBlocked  FriendshipStatus = "blocked"
)

// Friendship - Дружеские связи
type Friendship struct {
	ID       uint             `gorm:"primaryKey" json:"id"`
	UserID   uint             `gorm:"not null;index" json:"user_id"`            // Кто отправил запрос
	FriendID uint             `gorm:"not null;index" json:"friend_id"`          // Кому отправили
	Status   FriendshipStatus `gorm:"not null;default:'pending'" json:"status"` // pending, accepted, blocked

	User   User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Friend User `gorm:"foreignKey:FriendID" json:"friend,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName - Имя таблицы
func (Friendship) TableName() string {
	return "friendships"
}
