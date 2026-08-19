// backend/video-service/models/subscription.go
package models

import (
	"time"

	"gorm.io/gorm"
)

type Subscription struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	SubscriberID uint           `gorm:"not null;index" json:"subscriber_id"` // Кто подписался
	ChannelID    uint           `gorm:"not null;index" json:"channel_id"`    // На кого подписался
	CreatedAt    time.Time      `json:"created_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}
