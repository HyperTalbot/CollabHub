// backend/messenger-service/models/notification_settings.go
package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// UintArray - кастомный тип для массива uint в PostgreSQL
type UintArray []uint

// Value - сериализация для БД
func (a UintArray) Value() (driver.Value, error) {
	if len(a) == 0 {
		return "{}", nil
	}
	return json.Marshal(a)
}

// Scan - десериализация из БД
func (a *UintArray) Scan(value interface{}) error {
	if value == nil {
		*a = []uint{}
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to scan UintArray")
	}

	return json.Unmarshal(bytes, a)
}

// NotificationSettings - Настройки уведомлений
type NotificationSettings struct {
	UserID uint `gorm:"primaryKey" json:"user_id"`

	// Глобальные настройки
	MuteAll bool `gorm:"default:false" json:"mute_all"`

	// Используем jsonb тип для гибкости
	// Для личных чатов
	MutedConversations UintArray `gorm:"type:jsonb;default:'[]'" json:"muted_conversations"`

	// Для групп
	MutedGroups UintArray `gorm:"type:jsonb;default:'[]'" json:"muted_groups"`

	// Для серверов
	MutedServers  UintArray `gorm:"type:jsonb;default:'[]'" json:"muted_servers"`
	MutedChannels UintArray `gorm:"type:jsonb;default:'[]'" json:"muted_channels"`

	// Типы уведомлений
	ShowMessagePreview bool `gorm:"default:true" json:"show_message_preview"`
	PlaySound          bool `gorm:"default:true" json:"play_sound"`

	UpdatedAt time.Time `json:"updated_at"`
}
