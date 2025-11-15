package models

import (
	"time"

	"gorm.io/gorm"
)

type Comment struct {
	ID        uint            `gorm:"primaryKey" json:"id"`
	PostID    uint            `gorm:"not_null;index" json:"post_id"`    // К какому посту относится
	ParentID  *uint           `gorm:"index" json:"parent_id,omitempty"` // ID родительского коммента
	UserID    uint            `gorm:"not_null;index" json:"user_id"`    // Кто оставил
	Content   string          `gorm:"type:text;index" json:"content"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	DeletedAt *gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Виртуальные поля для отображения на фронте (аналогично посту)
	LikesCount  int64 `gorm:"-" json:"likes_count"`
	IsLikedByMe bool  `gorm:"-" json:"is_liked_by_me"`
	// Здесь также может быть User, чтобы получить имя пользователя, но пока оставим ID

	// Это поле будет содержать всех детей комментария (заполняется вручную)
	Replies []*Comment `gorm:"-" json:"replies,omitempty"`
}
