// backend/recommendation-service/models/trending.go
package models

import "time"

// TrendingContent - Кэш трендового контента
type TrendingContent struct {
	ID          uint        `gorm:"primaryKey" json:"id"`
	ContentType ContentType `gorm:"not null;index" json:"content_type"`
	ContentID   uint        `gorm:"not null" json:"content_id"`

	// Метрики за разные периоды
	ViewsHour int64 `json:"views_hour"`
	ViewsDay  int64 `json:"views_day"`
	ViewsWeek int64 `json:"views_week"`

	EngagementScore float64 `json:"engagement_score"`            // Вычисляемый показатель
	TrendingScore   float64 `gorm:"index" json:"trending_score"` // Финальный скор

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
