// backend/messenger-service/models/channel_folder.go
package models

import (
	"time"

	"gorm.io/gorm"
)

// ChannelFolder — папка для каналов и вложенных папок (как в проводнике).
// ParentID == nil → корневой уровень. Вложенность не ограничена.
type ChannelFolder struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	ServerID uint   `gorm:"not null;index" json:"server_id"`
	ParentID *uint  `gorm:"index" json:"parent_id"`
	Name     string `gorm:"not null" json:"name"`
	Position int    `gorm:"default:0" json:"position"`
	IsPinned bool   `gorm:"default:false" json:"is_pinned"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
