package models

import (
	"time"

	"gorm.io/gorm"
)

type Server struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Name        string `gorm:"not null" json:"name"`
	Description string `json:"description"` // Опционально
	AvatarURL   string `json:"avatar_url"`
	OwnerID     uint   `gorm:"not null" json:"owner_id"`

	// Хештеги можно хранить как массив сток (PostgreSQL поддерживает)
	// Или как простую строку через запятую для простоты. Выбрали строку.
	Tags string // Пример: "gaming,dev,friends"

	// Связи
	Channels []Channel `gorm:"foreignKey:ServerID" json:"channels,omitempty"`      // Каналы внутри сервера
	Members  []User    `gorm:"many2many:server_members;" json:"members,omitempty"` // Участники сервера

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}
