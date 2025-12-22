package models

import (
	"time"
)

type User struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Username     string `gorm:"size:50;not null;unique" json:"username"`
	Email        string `gorm:"size:100;not null;unique" json:"email"`
	PasswordHash string `gorm:"size:255;not null" json:"-"` // ВАЖНО: json:"-" скрывает это поле из JSON-ответов
	DisplayName  string `gorm:"size:100" json:"display_name"`
	Role         string `gorm:"default:'user'" json:"role"` // 'user' | 'admin'

	// Профиль
	Bio       string `json:"bio"`
	AvatarURL string `gorm:"size:255" json:"avatar_url"`
	CoverURL  string `json:"cover_url"` // обложка
	Location  string `json:"location"`
	Website   string `json:"website"`

	ResetToken        string    `json:"-"` // Скрываем из JSON
	ResetTokenExpires time.Time `json:"-"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// (Мы можем добавить здесь методы, например, для хэширования пароля)
