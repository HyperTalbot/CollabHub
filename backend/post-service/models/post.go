package models

import (
	"time"

	"gorm.io/gorm"
)

type Post struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	UserID        uint           `gorm:"not null;index" json:"user_id"`
	Title         string         `gorm:"size:255" json:"title"`
	Content       string         `gorm:"type:text;not null" json:"content"` // Основной текст поста
	LikesCount    int64          `gorm:"-" json:"likes_count"`
	IsLikedByMe   bool           `gorm:"-" json:"is_liked_by_me"`
	CommentsCount int64          `gorm:"-" json:"comments_count"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}
