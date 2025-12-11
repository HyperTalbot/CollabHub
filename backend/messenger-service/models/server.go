package models

import (
	"time"

	"gorm.io/gorm"
)

type Server struct {
	ID          uint   `gorm:"primaryKey"`
	Name        string `gorm:"not null"`
	Description string // Опционально
	AvatarURL   string
	OwnerID     uint `gorm:"not null"`

	// Хештеги можно хранить как массив сток (PostgreSQL поддерживает)
	// Или как простую строку через запятую для простоты. Выбрали строку.
	Tags string // Пример: "gaming,dev,friends"

	// Связи
	Channels []Channel // Каналы внутри сервера
	Members  []User    `gorm:"many2many:server_members;"` // Участники сервера

	CreateAt  time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
