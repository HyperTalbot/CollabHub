package models

import "time"

type Like struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	// Ключи связи
	UserID uint `gorm:"not null;uniqueIndex:idx_user_post" json:"user_id"`
	PostID uint `gorm:"not null;uniqueIndex:idx_user_post" json:"post_id"`
}
