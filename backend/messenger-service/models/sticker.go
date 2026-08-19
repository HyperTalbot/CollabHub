package models

import "time"

// Sticker - Стикеры
type Sticker struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	Name   string `gorm:"not null" json:"name"`
	URL    string `gorm:"not null" json:"url"`
	PackID uint   `gorm:"not null;index" json:"pack_id"`

	CreatedAt time.Time `json:"created_at"`
}

// StickerPack - Пак стикеров
type StickerPack struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Name        string `gorm:"not null" json:"name"`
	Description string `json:"description"`
	CoverURL    string `json:"cover_url"`
	CreatedBy   uint   `json:"created_by"`

	Stickers  []Sticker `gorm:"foreignKey:PackID" json:"stickers"`
	CreatedAt time.Time `json:"created_at"`
}
