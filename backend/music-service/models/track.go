// backend/music-service/models/track.go
package models

import (
	"time"

	"gorm.io/gorm"
)

type Track struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"not null" json:"title"`
	Artist      string         `gorm:"not null" json:"artist"`
	Album       string         `json:"album"`
	Description string         `json:"description"`
	Duration    int            `json:"duration"` // В секундах
	CoverURL    string         `json:"cover_url"`
	AudioURL    string         `gorm:"not null" json:"audio_url"`
	Genre       string         `json:"genre"`
	Lyrics      string         `gorm:"type:text" json:"lyrics"`
	ReleaseYear int            `json:"release_year"`
	UserID      uint           `gorm:"not null;index" json:"user_id"`
	AlbumID     *uint          `gorm:"index" json:"album_id"`
	PlayCount   int            `gorm:"default:0" json:"play_count"`
	LikesCount  int            `gorm:"default:0" json:"likes_count"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type Tag struct {
	ID   uint   `gorm:"primaryKey" json:"id"`
	Name string `gorm:"unique;not null" json:"name"`
}

type Playlist struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `json:"description"`
	CoverURL    string         `json:"cover_url"`
	UserID      uint           `gorm:"not null" json:"user_id"`
	IsPublic    bool           `gorm:"default:true" json:"is_public"`
	Tracks      []Track        `gorm:"many2many:playlist_tracks;" json:"tracks,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type TrackLike struct {
	UserID    uint      `gorm:"primaryKey" json:"user_id"`
	TrackID   uint      `gorm:"primaryKey" json:"track_id"`
	CreatedAt time.Time `json:"created_at"`
}

type ListeningHistory struct {
	ID       uint      `gorm:"primaryKey" json:"id"`
	UserID   uint      `gorm:"not null;index" json:"user_id"`
	TrackID  uint      `gorm:"not null;index" json:"track_id"`
	PlayedAt time.Time `gorm:"index" json:"played_at"`
	Duration int       `json:"duration"` // Сколько секунд прослушано
}
