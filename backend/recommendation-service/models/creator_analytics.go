// backend/recommendation-service/models/creator_analytics.go

package models

import "time"

type CreatorAnalytics struct {
	ID        uint `gorm:"primaryKey"`
	CreatorID uint `gorm:"not null;uniqueIndex"`

	// Метрики
	TotalViews     int64   `json:"total_views"`
	UniqueViewers  int64   `json:"unique_viewers"`
	AvgWatchTime   float64 `json:"avg_watch_time"`
	CompletionRate float64 `json:"completion_rate"` // % досмотров

	// Аудитория
	TopViewerAges string `gorm:"type:jsonb" json:"top_viewer_ages"` // ["18-24", "25-34"]
	TopViewerGeos string `gorm:"type:jsonb" json:"top_viewer_geos"` // ["US", "RU", "UK"]

	// Источники трафика
	FromRecommended int64 `json:"from_recommended"` // Из рекомендаций
	FromSearch      int64 `json:"from_search"`      // Из поиска
	FromSubscribers int64 `json:"from_subscribers"` // От подписчиков
	FromShares      int64 `json:"from_shares"`      // Из репостов

	UpdatedAt time.Time `json:"updated_at"`
}
