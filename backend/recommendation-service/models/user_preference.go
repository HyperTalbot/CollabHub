// backend/recommendation-service/models/user_preference.go
package models

import (
	"time"
)

// UserPreference - Предпочтения пользователя (вычисляемые)
type UserPreference struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	UserID uint `gorm:"uniqueIndex;not null" json:"user_id"`

	// Векторы интересов (JSON массивы категорий/тегов)
	TopCategories *string `gorm:"type:jsonb;default:null" json:"top_categories"` // ["tech", "gaming", "music"]
	TopAuthors    *string `gorm:"type:jsonb;default:null" json:"top_authors"`    // [user_id1, user_id2, ...]

	// Предпочтения по типам контента (%)
	PostsWeight  float32 `gorm:"default:25" json:"posts_weight"`
	VideosWeight float32 `gorm:"default:25" json:"videos_weight"`
	ShortsWeight float32 `gorm:"default:25" json:"shorts_weight"`
	MusicWeight  float32 `gorm:"default:25" json:"music_weight"`

	// Время активности (для персонализации времени публикации)
	// ActiveHours string `gorm:"type:jsonb" json:"active_hours"` // [14, 15, 20, 21, 22]

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
