package models

import "time"

type CommentLike struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"uniqueIndex:idx_user_comment" json:"user_id"`
	CommentID uint      `gorm:"uniqueIndex:idx_user_comment" json:"comment_id"`
	CreatedAt time.Time `json:"created_at"`
}
