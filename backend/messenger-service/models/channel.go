// backend/messenger-service/models/channel.go
package models

import (
	"time"

	"gorm.io/gorm"
)

type ChannelType string

const (
	ChannelTypeText  ChannelType = "text"
	ChannelTypeVoice ChannelType = "voice"
)

type Channel struct {
	ID         uint        `gorm:"primaryKey" json:"id"`
	ServerID   uint        `gorm:"not null;index" json:"server_id"`
	Server     Server      `gorm:"foreignKey:ServerID" json:"-"`
	CategoryID *uint       `gorm:"index" json:"category_id"`
	Name       string      `gorm:"not null" json:"name"`
	Type       ChannelType `gorm:"not null;default:text" json:"type"`
	IsPrivate  bool        `gorm:"default:false" json:"is_private"`
	IsPinned   bool        `gorm:"default:false" json:"is_pinned"`
	Position   int         `gorm:"default:0" json:"position"`

	// Связь с сообщениями (вместо ConversationID будет ChannelID)
	// Messages []Message `gorm:"foreignKey:ChannelID"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
