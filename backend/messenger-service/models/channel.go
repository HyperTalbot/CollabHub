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
	ID       uint        `gorm:"primaryKey"`
	ServerID uint        `gorm:"not null"` // <-- Привязка к серверу
	Name     string      `gorm:"not null"`
	Type     ChannelType `gorm:"default:'text'"`
	Topic    string      // Тема канала

	// Связь с сообщениями (вместо ConversationID будет ChannelID)
	// Messages []Message `gorm:"foreignKey:ChannelID"`

	CreateAt  time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
