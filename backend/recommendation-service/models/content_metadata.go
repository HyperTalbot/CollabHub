// backend/recommendation-service/models/content_metadata.go
package models

import "time"

// ContentMetadata - Метаданные контента для категоризации
type ContentMetadata struct {
	ID          uint        `gorm:"primaryKey" json:"id"`
	ContentType ContentType `gorm:"not null;index:idx_content_meta" json:"content_type"`
	ContentID   uint        `gorm:"not null;index:idx_content_meta" json:"content_id"`

	// Категории (получаем из других сервисов)
	Category string  `json:"category"`                            // "tech", "cooking", "gaming"
	Tags     *string `gorm:"type:jsonb;default:null" json:"tags"` // ИЗМЕНЕНО: указатель + default null // ["python", "tutorial"]
	AuthorID uint    `json:"author_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName - имя таблицы
func (ContentMetadata) TableName() string {
	return "content_metadata"
}
