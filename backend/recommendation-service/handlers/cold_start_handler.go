// backend/recommendation-service/handlers/cold_start_handler.go
package handlers

import (
	"backend/recommendation-service/models"
	"log"
	"time"
)

// Визуализация:

// Новое видео опубликовано
//          ↓
// ┌─────────────────────┐
// │  ЭТАП 1: Тест       │
// │  Показ 100 людям    │
// └──────────┬──────────┘
//            ↓
//     Досмотрели 70%?
//            ↓
//     ┌──────┴──────┐
//     │  ДА         │  НЕТ
//     ↓             ↓
// ┌───────────┐  ┌──────────┐
// │ Продвигаем│  │ Стоп     │
// │ + 1000    │  │ показов  │
// └───────────┘  └──────────┘
//     ↓
//     Досмотрели 60%?
//     ↓
// ┌───────────────┐
// │ Продвигаем    │
// │ + 10,000      │
// │ (вирусное!)   │
// └───────────────┘

// Метрики успешности контента
type ColdStartMetrics struct {
	CompletionRate  float64 // % досмотров
	EngagementScore float64 // Средний engagement
	CTR             float64 // % кликов из показов
}

// coldStartPromotion - Продвижение нового контента (асинхронно)
func (h *RecommendationHandler) coldStartPromotion(contentType models.ContentType, contentID uint) {
	// ЭТАП 1: Тестовая аудитория (первые 100 показов)
	testAudience := h.getRandomUsers(100)

	for _, userID := range testAudience {
		h.showContentToUser(userID, contentType, contentID, "cold_start")
	}

	// ЭТАП 2: Анализ через 24 часа (в реальности запускается через cron)
	// Здесь показан упрощенный вариант
	go func() {
		time.Sleep(24 * time.Hour)

		metrics := h.analyzePerformance(contentType, contentID)

		// ЭТАП 3: Решение о продвижении
		if metrics.CompletionRate > 0.5 && metrics.EngagementScore > 40 {
			h.promoteToWiderAudience(contentType, contentID, 1000)
		} else if metrics.CompletionRate > 0.3 {
			h.promoteToNiche(contentType, contentID, 500)
		} else {
			log.Printf("Content %s:%d didn't pass cold start", contentType, contentID)
		}
	}()
}

// analyzePerformance - Анализ метрик контента
func (h *RecommendationHandler) analyzePerformance(
	contentType models.ContentType,
	contentID uint,
) ColdStartMetrics {
	var views []models.View
	h.DB.Where("content_type = ? AND content_id = ?", contentType, contentID).Find(&views)

	if len(views) == 0 {
		return ColdStartMetrics{}
	}

	completed := 0
	totalEngagement := 0.0

	for _, v := range views {
		if v.Completed {
			completed++
		}
		totalEngagement += v.EngagementScore
	}

	return ColdStartMetrics{
		CompletionRate:  float64(completed) / float64(len(views)),
		EngagementScore: totalEngagement / float64(len(views)),
	}
}

// getRandomUsers - Получить случайных пользователей
func (h *RecommendationHandler) getRandomUsers(count int) []uint {
	var userIDs []uint

	// Получаем всех активных пользователей
	h.DB.Model(&models.View{}).
		Distinct("user_id").
		Order("RANDOM()").
		Limit(count).
		Pluck("user_id", &userIDs)

	return userIDs
}

// showContentToUser - Добавить контент в рекомендации пользователя
func (h *RecommendationHandler) showContentToUser(
	userID uint,
	contentType models.ContentType,
	contentID uint,
	reason string,
) {
	// Создаем запись о показе (impression)
	// В реальности это можно сохранять в отдельную таблицу impressions
	log.Printf("Showing %s:%d to user %d (reason: %s)", contentType, contentID, userID, reason)

	// TODO: Можно создать таблицу impressions для трекинга показов
}

// promoteToWiderAudience - Расширенное продвижение контента
func (h *RecommendationHandler) promoteToWiderAudience(
	contentType models.ContentType,
	contentID uint,
	targetUsers int,
) {
	log.Printf("🚀 Promoting %s:%d to %d users (wider audience)", contentType, contentID, targetUsers)

	// 1. Находим пользователей, которые досмотрели контент
	var completedViews []models.View
	h.DB.Where("content_type = ? AND content_id = ? AND completed = ?",
		contentType, contentID, true).
		Find(&completedViews)

	// ИСПРАВЛЕНО: итерируем по completedViews
	engagedUserIDs := make([]uint, len(completedViews))
	for i, v := range completedViews {
		engagedUserIDs[i] = v.UserID
	}

	if len(engagedUserIDs) == 0 {
		log.Printf("⚠️ No engaged users found for %s:%d", contentType, contentID)
		return
	}

	// 2. Находим похожих пользователей
	similarUsers := h.findSimilarUsersToGroup(engagedUserIDs, targetUsers)

	// 3. Показываем им контент
	for _, userID := range similarUsers {
		h.showContentToUser(userID, contentType, contentID, "promoted")
	}

	log.Printf("✅ Promoted to %d similar users", len(similarUsers))
}

// promoteToNiche - Продвижение в нишевую аудиторию
func (h *RecommendationHandler) promoteToNiche(
	contentType models.ContentType,
	contentID uint,
	targetUsers int,
) {
	log.Printf("🎯 Promoting %s:%d to %d niche users", contentType, contentID, targetUsers)

	// Загружаем метаданные контента
	var metadata models.ContentMetadata
	h.DB.Where("content_type = ? AND content_id = ?", contentType, contentID).First(&metadata)

	if metadata.ID == 0 {
		return
	}

	// Находим пользователей, интересующихся этой категорией
	var preferences []models.UserPreference

	// ИСПРАВЛЕНО: используем SQL LIKE с проверкой на null
	h.DB.Where("top_categories IS NOT NULL AND top_categories LIKE ?", "%"+metadata.Category+"%").
		Limit(targetUsers).
		Find(&preferences)

	for _, pref := range preferences {
		h.showContentToUser(pref.UserID, contentType, contentID, "niche")
	}
}

// findSimilarUsersToGroup - Найти пользователей похожих на группу
func (h *RecommendationHandler) findSimilarUsersToGroup(userIDs []uint, limit int) []uint {
	if len(userIDs) == 0 {
		return []uint{}
	}

	// Находим что лайкнула эта группа
	var likedContent []models.View
	h.DB.Where("user_id IN ? AND liked = ?", userIDs, true).
		Select("content_type, content_id").
		Group("content_type, content_id").
		Find(&likedContent)

	if len(likedContent) == 0 {
		return []uint{}
	}

	// Находим других пользователей с похожими лайками
	type UserScore struct {
		UserID uint
		Score  int64
	}

	var similarUsers []UserScore

	// Формируем условия для поиска
	conditions := make([][]interface{}, len(likedContent))
	for i, content := range likedContent {
		conditions[i] = []interface{}{content.ContentType, content.ContentID}
	}

	h.DB.Model(&models.View{}).
		Select("user_id, COUNT(*) as score").
		Where("user_id NOT IN ?", userIDs).
		Where("liked = ?", true).
		Group("user_id").
		Order("score DESC").
		Limit(limit).
		Scan(&similarUsers)

	result := make([]uint, len(similarUsers))
	for i, u := range similarUsers {
		result[i] = u.UserID
	}

	return result
}

// scoreContent - Оценка качества контента
// ❌ НЕ УЧИТЫВАЕМ время публикации!
// ❌ НЕ УЧИТЫВАЕМ "регулярность" автора!
func (h *RecommendationHandler) scoreContent(
	contentType models.ContentType,
	contentID uint,
) float64 {
	score := 0.0

	// 1. Качество контента (cold start metrics)
	metrics := h.analyzePerformance(contentType, contentID)
	score += metrics.CompletionRate * 50.0
	score += metrics.EngagementScore

	// 2. Свежесть (новое = бонус, но не обязательно)
	age := h.getContentAge(contentType, contentID)
	if age < 24*time.Hour {
		score += 10.0 // Небольшой бонус за новизну
	}

	// 3. Trending фактор
	var trending models.TrendingContent
	h.DB.Where("content_type = ? AND content_id = ?", contentType, contentID).First(&trending)
	if trending.ID > 0 {
		score += trending.TrendingScore * 0.3
	}

	return score
}

// getContentAge - Получить возраст контента
func (h *RecommendationHandler) getContentAge(
	contentType models.ContentType,
	contentID uint,
) time.Duration {
	var metadata models.ContentMetadata
	h.DB.Where("content_type = ? AND content_id = ?", contentType, contentID).First(&metadata)

	if metadata.ID == 0 {
		return 0
	}

	return time.Since(metadata.CreatedAt)
}
