// backend/video-service/models/video.go
package models

import (
	"time"

	"gorm.io/gorm"
)

type Video struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Title        string         `gorm:"not null" json:"title"`
	Description  string         `gorm:"type:text" json:"description"`
	VideoURL     string         `gorm:"not null" json:"video_url"`
	ThumbnailURL string         `json:"thumbnail_url"`
	Duration     int            `json:"duration"` // В секундах
	Category     string         `json:"category"`
	Tags         string         `gorm:"type:text" json:"tags"` // JSON array as string
	UserID       uint           `gorm:"not null;index" json:"user_id"`
	Username     string         `json:"username"` // Денормализация для быстрого доступа
	ViewCount    int            `gorm:"default:0" json:"view_count"`
	LikeCount    int            `gorm:"default:0" json:"like_count"`
	DislikeCount int            `gorm:"default:0" json:"dislike_count"`
	IsPublic     bool           `gorm:"default:true" json:"is_public"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type VideoLike struct {
	UserID    uint      `gorm:"primaryKey" json:"user_id"`
	VideoID   uint      `gorm:"primaryKey" json:"video_id"`
	IsLike    bool      `json:"is_like"` // true = like, false = dislike
	CreatedAt time.Time `json:"created_at"`
}

type VideoComment struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	VideoID   uint           `gorm:"not null;index" json:"video_id"`
	UserID    uint           `gorm:"not null;index" json:"user_id"`
	Username  string         `json:"username"`
	Content   string         `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type ViewHistory struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	VideoID   uint      `gorm:"not null;index" json:"video_id"`
	WatchedAt time.Time `gorm:"index" json:"watched_at"`
	Duration  int       `json:"duration"` // Сколько секунд просмотрено
}

type VideoPlaylist struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"not null" json:"name"`
	Description  string         `json:"description"`
	ThumbnailURL string         `json:"thumbnail_url"`
	UserID       uint           `gorm:"not null;index" json:"user_id"`
	IsPublic     bool           `gorm:"default:true" json:"is_public"`
	Videos       []Video        `gorm:"many2many:playlist_videos;" json:"videos,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}
