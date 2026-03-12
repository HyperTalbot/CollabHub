// backend/recommendation-service/handlers/passive_user_handler.go
package handlers

import (
	"backend/recommendation-service/models"
	"sort"
)

// getRecommendationsForPassiveUser - Рекомендации для пассивных пользователей
func (h *RecommendationHandler) getRecommendationsForPassiveUser(userID uint) []ContentRecommendation {
	// 1. Анализируем что пользователь досматривает
	var completedViews []models.View
	h.DB.Where("user_id = ? AND completed = ?", userID, true).
		Order("created_at DESC").
		Limit(50).
		Find(&completedViews)

	if len(completedViews) == 0 {
		// Если нет досмотренного контента - возвращаем trending
		return h.getTrendingContent("all", 20)
	}

	// 2. Собираем content_id досмотренного контента
	contentIDs := make([]uint, len(completedViews))
	contentTypes := make([]models.ContentType, len(completedViews))
	for i, v := range completedViews {
		contentIDs[i] = v.ContentID
		contentTypes[i] = v.ContentType
	}

	// 3. Загружаем метаданные (категории, теги, авторов)
	var metadata []models.ContentMetadata
	h.DB.Where("content_id IN ?", contentIDs).Find(&metadata)

	// 4. Строим карту категорий
	categoryCount := make(map[string]int)
	authorCount := make(map[uint]int)

	for _, meta := range metadata {
		categoryCount[meta.Category]++
		authorCount[meta.AuthorID]++
	}

	// 5. Находим топ категории
	topCategories := getTop3FromMap(categoryCount)
	topAuthors := getTop5FromMap(authorCount)

	// 6. Ищем новый контент из этих категорий
	recommendations := h.findContentByCategories(topCategories, topAuthors, userID)

	return recommendations
}

// getTop3FromMap - Получить топ-3 ключа из map[string]int
func getTop3FromMap(data map[string]int) []string {
	type kv struct {
		Key   string
		Value int
	}

	var sorted []kv
	for k, v := range data {
		sorted = append(sorted, kv{k, v})
	}

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Value > sorted[j].Value
	})

	result := make([]string, 0, 3)
	for i := 0; i < len(sorted) && i < 3; i++ {
		result = append(result, sorted[i].Key)
	}

	return result
}

// getTop5FromMap - Получить топ-5 ключей из map[uint]int
func getTop5FromMap(data map[uint]int) []uint {
	type kv struct {
		Key   uint
		Value int
	}

	var sorted []kv
	for k, v := range data {
		sorted = append(sorted, kv{k, v})
	}

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Value > sorted[j].Value
	})

	result := make([]uint, 0, 5)
	for i := 0; i < len(sorted) && i < 5; i++ {
		result = append(result, sorted[i].Key)
	}

	return result
}

// findContentByCategories - Найти контент по категориям и авторам
func (h *RecommendationHandler) findContentByCategories(
	categories []string,
	authors []uint,
	excludeUserID uint,
) []ContentRecommendation {
	var metadata []models.ContentMetadata

	query := h.DB.Model(&models.ContentMetadata{})

	if len(categories) > 0 {
		query = query.Where("category IN ?", categories)
	}

	if len(authors) > 0 {
		query = query.Or("author_id IN ?", authors)
	}

	query.Order("created_at DESC").Limit(50).Find(&metadata)

	recommendations := make([]ContentRecommendation, 0)
	for _, meta := range metadata {
		recommendations = append(recommendations, ContentRecommendation{
			ContentType: meta.ContentType,
			ContentID:   meta.ContentID,
			Score:       100.0,
			Reason:      "your_interests",
		})
	}

	return recommendations
}

// Пример работы:
// Пассивный пользователь досмотрел:
// ├─ 10 видео про кулинарию
// ├─ 8 видео про Python
// └─ 5 видео про котов

// Система поняла:
// ├─ Категория "cooking": 40%
// ├─ Категория "tech/python": 35%
// └─ Категория "cats": 25%

// Рекомендует:
// ├─ Новое видео про пасту (cooking) ✅
// ├─ Туториал по Django (python) ✅
// └─ Смешное видео про котов ✅
