package models

import (
	"time"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"size:50;not null;unique" json:"username"`
	Email        string    `gorm:"size:100;not null;unique" json:"email"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"` // ВАЖНО: json:"-" скрывает это поле из JSON-ответов
	DisplayName  string    `gorm:"size:100" json:"display_name"`
	Bio          string    `json:"bio"`
	AvatarURL    string    `gorm:"size:255" json:"avatar_url"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// (Мы можем добавить здесь методы, например, для хэширования пароля)
