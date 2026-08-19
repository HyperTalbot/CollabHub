// backend/recommendation-service/models/view.go
package models

import (
	"time"

	"gorm.io/gorm"
)

type ContentType string

const (
	ContentTypePost   ContentType = "post"
	ContentTypeVideo  ContentType = "video"
	ContentTypeShort  ContentType = "short"
	ContentTypeStream ContentType = "stream"
	ContentTypeMusic  ContentType = "music"
)

// View - Просмотр контента
type View struct {
	ID          uint        `gorm:"primaryKey" json:"id"`
	UserID      uint        `gorm:"not null;index:idx_user_content" json:"user_id"`
	ContentType ContentType `gorm:"not null;index:idx_content" json:"content_type"`
	ContentID   uint        `gorm:"not null;index:idx_user_content,idx_content" json:"content_id"`

	// Метрики
	WatchTime       int     `gorm:"default:0" json:"watch_time"`       // Секунды просмотра
	ContentDuration int     `gorm:"default:0" json:"content_duration"` // Длина контента
	Progress        float64 `gorm:"default:0" json:"progress"`         // Процент просмотра (0-100)
	Completed       bool    `gorm:"default:false" json:"completed"`    // Досмотрел до конца

	// Поведенческие сигналы
	Skipped        bool `gorm:"default:false" json:"skipped"`          // Закрыл через < 10 сек
	RepeatView     int  `gorm:"default:0" json:"repeat_view"`          // Пересматривал N раз
	ClickedFromRec bool `gorm:"default:false" json:"clicked_from_rec"` // Открыл из рекомендаций

	// Явные действия
	Liked     bool `gorm:"default:false" json:"liked"`
	Commented bool `gorm:"default:false" json:"commented"`
	Shared    bool `gorm:"default:false" json:"shared"`

	// Engagement Score (вычисляемый)
	EngagementScore float64 `gorm:"default:0" json:"engagement_score"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// CalculateEngagementScore - Вычисление Engagement Score БЕЗ лайков
func (v *View) CalculateEngagementScore() float64 {
	score := 0.0

	// 1. Досмотрел до конца = 50 баллов (ОЧЕНЬ сильный сигнал)
	if v.Completed {
		score += 50.0
	}

	// 2. Время просмотра относительно длины контента
	if v.ContentDuration > 0 {
		watchRatio := float64(v.WatchTime) / float64(v.ContentDuration)
		score += watchRatio * 30.0 // До 30 баллов
	}

	// 3. Повторные просмотры = мега интерес
	score += float64(v.RepeatView) * 20.0 // 20 баллов за каждый пересмотр

	// 4. Открыл из рекомендаций = доверие к системе
	if v.ClickedFromRec {
		score += 10.0
	}

	// 5. ШТРАФЫ
	if v.Skipped {
		score -= 30.0 // Закрыл через 5 сек = не зашло
	}

	// 6. Бонусы за явные действия (если есть)
	if v.Liked {
		score += 15.0
	}
	if v.Commented {
		score += 25.0
	}
	if v.Shared {
		score += 35.0 // Поделился = самый сильный сигнал
	}

	return score
}

// TableName - имя таблицы
func (View) TableName() string {
	return "views"
}

// Пассивный зритель (без лайков):
// Видео про котов (длина 5 минут):
// ├─ Досмотрел до конца: Да ✅ → +50 баллов
// ├─ Время просмотра: 300 сек из 300 → +30 баллов
// ├─ Пересматривал: 0 раз → 0 баллов
// ├─ Лайк: Нет
// └─ ИТОГО: 80 баллов → СИЛЬНЫЙ ИНТЕРЕС! 🔥

// Видео про физику (длина 10 минут):
// ├─ Досмотрел до конца: Нет ❌ → 0 баллов
// ├─ Время просмотра: 20 сек из 600 → +1 балл
// ├─ Скипнул (закрыл быстро): Да → -30 баллов
// └─ ИТОГО: -29 баллов → НЕ ИНТЕРЕСНО ❌
// Вывод: Даже без лайков система понимает интересы!
