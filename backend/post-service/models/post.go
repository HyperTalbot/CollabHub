package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

// StringArray — список строк, хранится в БД как JSON в text-колонке (карусель)
type StringArray []string

func (s StringArray) Value() (driver.Value, error) {
	if s == nil {
		s = []string{}
	}
	return json.Marshal(s)
}

func (s *StringArray) Scan(src interface{}) error {
	if src == nil {
		*s = []string{}
		return nil
	}
	var bytes []byte
	switch v := src.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return errors.New("unsupported type for StringArray")
	}
	return json.Unmarshal(bytes, s)
}

type Post struct {
	ID              uint   `gorm:"primaryKey" json:"id"`
	UserID          uint   `gorm:"not null;index" json:"user_id"`
	Title           string `gorm:"size:255" json:"title"`
	Content         string `gorm:"type:text;not null" json:"content"` // Markdown
	AuthorAvatarUrl string `gorm:"size:255" json:"author_avatar_url"`
	ImageURL        string `gorm:"type:varchar(255)" json:"image_url,omitempty"`
	// НОВОЕ: стиль поста 'reddit' (карусель) | 'article' (картинки в тексте)
	PostStyle string `gorm:"size:20;default:'article'" json:"post_style"`
	// НОВОЕ: картинки карусели (JSON-массив)
	ImageURLs StringArray `gorm:"type:text" json:"image_urls"`

	// Виртуальные поля для фронтенда
	UserUsername  string `gorm:"size:255" json:"user_username,omitempty"`
	UserAvatarUrl string `gorm:"-" json:"user_avatar_url,omitempty"`
	LikesCount    int64  `gorm:"-" json:"likes_count"`
	IsLikedByMe   bool   `gorm:"-" json:"is_liked_by_me"`
	CommentsCount int64  `gorm:"-" json:"comments_count"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}