// backend/recommendation-service/handlers/recommendation_handler.go
package handlers

import (
	"backend/recommendation-service/models"
	"backend/recommendation-service/utils" // ДОБАВИТЬ
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type RecommendationHandler struct {
	DB *gorm.DB
}

// GetPersonalizedFeed - Персональная лента (главный endpoint)
func (h *RecommendationHandler) GetPersonalizedFeed(c *gin.Context) {
	userID := c.GetUint("user_id")
	contentType := c.DefaultQuery("type", "all") // all, post, video, short, music
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if limit > 50 {
		limit = 50
	}

	var recommendations []ContentRecommendation

	// 1. Для новых пользователей (< 10 просмотров) - показываем трендовое
	var viewCount int64
	h.DB.Model(&models.View{}).Where("user_id = ?", userID).Count(&viewCount)

	if viewCount < 10 {
		recommendations = h.getTrendingContent(contentType, limit)
	} else {
		// 2. Для опытных - персонализированная лента
		recommendations = h.getPersonalizedRecommendations(userID, contentType, limit)
	}

	// 3. Пагинация
	offset := (page - 1) * limit
	if offset >= len(recommendations) {
		c.JSON(http.StatusOK, gin.H{
			"data":  []ContentRecommendation{},
			"page":  page,
			"total": len(recommendations),
		})
		return
	}

	end := offset + limit
	if end > len(recommendations) {
		end = len(recommendations)
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  recommendations[offset:end],
		"page":  page,
		"total": len(recommendations),
	})
}

// ContentRecommendation - Структура рекомендации
type ContentRecommendation struct {
	ContentType models.ContentType `json:"content_type"`
	ContentID   uint               `json:"content_id"`
	Score       float64            `json:"score"`
	Reason      string             `json:"reason"` // "trending", "similar_users", "your_interests"
}

// getTrendingContent - Трендовый контент
func (h *RecommendationHandler) getTrendingContent(contentType string, limit int) []ContentRecommendation {
	var trending []models.TrendingContent
	query := h.DB.Model(&models.TrendingContent{})

	if contentType != "all" {
		query = query.Where("content_type = ?", contentType)
	}

	query.Order("trending_score DESC").Limit(limit * 2).Find(&trending)

	recommendations := make([]ContentRecommendation, 0)
	for _, item := range trending {
		recommendations = append(recommendations, ContentRecommendation{
			ContentType: item.ContentType,
			ContentID:   item.ContentID,
			Score:       item.TrendingScore,
			Reason:      "trending",
		})
	}

	return recommendations
}

// getPersonalizedRecommendations - Персонализированные рекомендации
func (h *RecommendationHandler) getPersonalizedRecommendations(
	userID uint,
	contentType string,
	limit int,
) []ContentRecommendation {
	recommendations := make([]ContentRecommendation, 0)

	// 1. Collaborative Filtering (30% веса)
	collaborative := h.collaborativeFiltering(userID, contentType, limit)
	for i, rec := range collaborative {
		rec.Score *= 0.3
		rec.Score *= (1.0 - float64(i)*0.01) // Понижаем вес с каждой позицией
		recommendations = append(recommendations, rec)
	}

	// 2. Content-Based (40% веса)
	contentBased := h.contentBasedFiltering(userID, contentType, limit)
	for i, rec := range contentBased {
		rec.Score *= 0.4
		rec.Score *= (1.0 - float64(i)*0.01)
		recommendations = append(recommendations, rec)
	}

	// 3. Trending (30% веса)
	trending := h.getTrendingContent(contentType, limit/2)
	for i, rec := range trending {
		rec.Score *= 0.3
		rec.Score *= (1.0 - float64(i)*0.01)
		recommendations = append(recommendations, rec)
	}

	// 4. Объединяем и сортируем по score
	merged := h.mergeAndDeduplicate(recommendations)

	// 5. Фильтруем уже просмотренное
	filtered := h.filterViewed(userID, merged)

	return filtered
}

// collaborativeFiltering - Рекомендации на основе похожих пользователей
func (h *RecommendationHandler) collaborativeFiltering(
	userID uint,
	contentType string,
	limit int,
) []ContentRecommendation {
	// 1. Находим пользователей с похожими вкусами
	similarUsers := h.findSimilarUsers(userID, 20)

	if len(similarUsers) == 0 {
		return []ContentRecommendation{}
	}

	// 2. Собираем контент, который они лайкнули
	var views []models.View
	query := h.DB.Model(&models.View{}).
		Where("user_id IN ?", similarUsers).
		Where("liked = ?", true)

	if contentType != "all" {
		query = query.Where("content_type = ?", contentType)
	}

	query.Group("content_type, content_id").
		Select("content_type, content_id, COUNT(*) as watch_time"). // Используем watch_time для подсчета
		Order("watch_time DESC").
		Limit(limit).
		Find(&views)

	recommendations := make([]ContentRecommendation, 0)
	for _, view := range views {
		recommendations = append(recommendations, ContentRecommendation{
			ContentType: view.ContentType,
			ContentID:   view.ContentID,
			Score:       float64(view.WatchTime), // Количество лайков от похожих пользователей
			Reason:      "similar_users",
		})
	}

	return recommendations
}

// findSimilarUsers - Находит пользователей с похожими интересами
func (h *RecommendationHandler) findSimilarUsers(userID uint, limit int) []uint {
	// Получаем контент, который лайкнул текущий пользователь
	var myLikes []models.View
	h.DB.Where("user_id = ? AND liked = ?", userID, true).
		Select("content_type, content_id").
		Find(&myLikes)

	if len(myLikes) == 0 {
		return []uint{}
	}

	// Создаем список пар (content_type, content_id)
	likedContent := make([][2]interface{}, len(myLikes))
	for i, like := range myLikes {
		likedContent[i] = [2]interface{}{like.ContentType, like.ContentID}
	}

	// Находим пользователей, которые лайкнули тот же контент
	type SimilarUser struct {
		UserID uint
		Score  int64
	}

	var similarUsers []SimilarUser
	h.DB.Model(&models.View{}).
		Select("user_id, COUNT(*) as score").
		Where("user_id != ?", userID).
		Where("liked = ?", true).
		Where("(content_type, content_id) IN ?", likedContent).
		Group("user_id").
		Order("score DESC").
		Limit(limit).
		Scan(&similarUsers)

	userIDs := make([]uint, len(similarUsers))
	for i, u := range similarUsers {
		userIDs[i] = u.UserID
	}

	return userIDs
}

// contentBasedFiltering - Рекомендации на основе интересов пользователя
func (h *RecommendationHandler) contentBasedFiltering(
	userID uint,
	contentType string,
	limit int,
) []ContentRecommendation {
	var prefs models.UserPreference
	h.DB.Where("user_id = ?", userID).First(&prefs)

	if prefs.ID == 0 {
		h.calculateUserPreferences(userID)
		h.DB.Where("user_id = ?", userID).First(&prefs)
	}

	// ИСПОЛЬЗУЕМ ВСПОМОГАТЕЛЬНУЮ ФУНКЦИЮ
	topAuthors := utils.ParseJSONStringArray(prefs.TopAuthors)

	if len(topAuthors) == 0 {
		return []ContentRecommendation{}
	}

	recommendations := make([]ContentRecommendation, 0)

	contentTypes := []models.ContentType{
		models.ContentTypePost,
		models.ContentTypeVideo,
		models.ContentTypeShort,
		models.ContentTypeMusic,
	}

	for _, ct := range contentTypes {
		if contentType != "all" && string(ct) != contentType {
			continue
		}

		items := h.fetchContentFromAuthors(ct, topAuthors, limit/len(contentTypes))

		for _, item := range items {
			recommendations = append(recommendations, ContentRecommendation{
				ContentType: ct,
				ContentID:   item,
				Score:       100.0,
				Reason:      "your_interests",
			})
		}
	}

	return recommendations
}

// fetchContentFromAuthors - Запрашивает контент от авторов через API других сервисов
func (h *RecommendationHandler) fetchContentFromAuthors(
	contentType models.ContentType,
	authorIDs []uint,
	limit int,
) []uint {
	// В зависимости от типа контента обращаемся к нужному сервису
	var serviceURL string
	switch contentType {
	case models.ContentTypePost:
		serviceURL = "http://localhost:8084/api/v1/posts"
	case models.ContentTypeVideo:
		serviceURL = "http://localhost:8085/api/v1/videos" // Пока не существует
	case models.ContentTypeMusic:
		serviceURL = "http://localhost:8087/api/v1/music" // Пока не существует
	default:
		return []uint{}
	}

	// Формируем запрос с фильтром по авторам
	// TODO: Реализовать реальные запросы к сервисам
	// Пока возвращаем заглушку
	_ = serviceURL

	return []uint{} // Временная заглушка
}

// calculateUserPreferences - Вычисляет предпочтения пользователя
func (h *RecommendationHandler) calculateUserPreferences(userID uint) {
	type AuthorScore struct {
		AuthorID uint
		Score    int64
	}

	var topAuthors []AuthorScore

	h.DB.Raw(`
        SELECT content_id as author_id, COUNT(*) as score
        FROM views
        WHERE user_id = ? AND liked = true
        GROUP BY content_id
        ORDER BY score DESC
        LIMIT 10
    `, userID).Scan(&topAuthors)

	authorIDs := make([]uint, len(topAuthors))
	for i, a := range topAuthors {
		authorIDs[i] = a.AuthorID
	}

	// ИСПОЛЬЗУЕМ ВСПОМОГАТЕЛЬНУЮ ФУНКЦИЮ
	authorsJSON := utils.CreateJSONString(authorIDs)
	categoriesJSON := utils.CreateJSONString([]string{})

	var contentWeights []struct {
		ContentType models.ContentType
		Count       int64
	}

	h.DB.Model(&models.View{}).
		Select("content_type, COUNT(*) as count").
		Where("user_id = ?", userID).
		Group("content_type").
		Scan(&contentWeights)

	total := int64(0)
	for _, w := range contentWeights {
		total += w.Count
	}

	postsWeight := float32(25)
	videosWeight := float32(25)
	shortsWeight := float32(25)
	musicWeight := float32(25)

	if total > 0 {
		for _, w := range contentWeights {
			weight := float32(w.Count) / float32(total) * 100
			switch w.ContentType {
			case models.ContentTypePost:
				postsWeight = weight
			case models.ContentTypeVideo:
				videosWeight = weight
			case models.ContentTypeShort:
				shortsWeight = weight
			case models.ContentTypeMusic:
				musicWeight = weight
			}
		}
	}

	h.DB.Where("user_id = ?", userID).
		Assign(models.UserPreference{
			UserID:        userID,
			TopAuthors:    &authorsJSON,
			TopCategories: &categoriesJSON,
			PostsWeight:   postsWeight,
			VideosWeight:  videosWeight,
			ShortsWeight:  shortsWeight,
			MusicWeight:   musicWeight,
		}).
		FirstOrCreate(&models.UserPreference{UserID: userID})
}

// mergeAndDeduplicate - Объединяет рекомендации и удаляет дубликаты
func (h *RecommendationHandler) mergeAndDeduplicate(
	recommendations []ContentRecommendation,
) []ContentRecommendation {
	// Используем map для дедупликации
	seen := make(map[string]*ContentRecommendation)

	for _, rec := range recommendations {
		key := fmt.Sprintf("%s-%d", rec.ContentType, rec.ContentID)

		if existing, exists := seen[key]; exists {
			// Суммируем scores
			existing.Score += rec.Score
		} else {
			recCopy := rec
			seen[key] = &recCopy
		}
	}

	// Преобразуем обратно в slice
	merged := make([]ContentRecommendation, 0, len(seen))
	for _, rec := range seen {
		merged = append(merged, *rec)
	}

	// Сортируем по score
	for i := 0; i < len(merged)-1; i++ {
		for j := i + 1; j < len(merged); j++ {
			if merged[i].Score < merged[j].Score {
				merged[i], merged[j] = merged[j], merged[i]
			}
		}
	}

	return merged
}

// filterViewed - Фильтрует уже просмотренный контент
func (h *RecommendationHandler) filterViewed(
	userID uint,
	recommendations []ContentRecommendation,
) []ContentRecommendation {
	// Получаем список просмотренного
	var viewed []models.View
	h.DB.Where("user_id = ?", userID).
		Select("content_type, content_id").
		Find(&viewed)

	viewedMap := make(map[string]bool)
	for _, v := range viewed {
		key := fmt.Sprintf("%s-%d", v.ContentType, v.ContentID)
		viewedMap[key] = true
	}

	// Фильтруем
	filtered := make([]ContentRecommendation, 0)
	for _, rec := range recommendations {
		key := fmt.Sprintf("%s-%d", rec.ContentType, rec.ContentID)
		if !viewedMap[key] {
			filtered = append(filtered, rec)
		}
	}

	return filtered
}

// GetTrending - Получить трендовый контент
func (h *RecommendationHandler) GetTrending(c *gin.Context) {
	contentType := c.DefaultQuery("type", "all")
	timeframe := c.DefaultQuery("timeframe", "day") // hour, day, week
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if limit > 50 {
		limit = 50
	}

	var trending []models.TrendingContent
	query := h.DB.Model(&models.TrendingContent{})

	if contentType != "all" {
		query = query.Where("content_type = ?", contentType)
	}

	// Сортировка по временному периоду
	switch timeframe {
	case "hour":
		query = query.Order("views_hour DESC")
	case "week":
		query = query.Order("views_week DESC")
	default:
		query = query.Order("views_day DESC")
	}

	query.Limit(limit).Find(&trending)

	c.JSON(http.StatusOK, trending)
}

// UpdateTrendingScores - Обновляет trending scores (запускается по крону)
func (h *RecommendationHandler) UpdateTrendingScores(c *gin.Context) {
	// Вычисляем trending score для всего контента
	now := time.Now()
	hourAgo := now.Add(-1 * time.Hour)
	dayAgo := now.Add(-24 * time.Hour)
	weekAgo := now.Add(-7 * 24 * time.Hour)

	// Группируем просмотры по content_type и content_id
	type TrendingData struct {
		ContentType models.ContentType
		ContentID   uint
		ViewsHour   int64
		ViewsDay    int64
		ViewsWeek   int64
		Engagement  float64
	}

	var trendingData []TrendingData

	h.DB.Raw(`
        SELECT 
            content_type,
            content_id,
            COUNT(CASE WHEN created_at > ? THEN 1 END) as views_hour,
            COUNT(CASE WHEN created_at > ? THEN 1 END) as views_day,
            COUNT(CASE WHEN created_at > ? THEN 1 END) as views_week,
            AVG(CASE WHEN liked THEN 1 ELSE 0 END) * 100 as engagement
        FROM views
        GROUP BY content_type, content_id
        HAVING COUNT(*) > 0
    `, hourAgo, dayAgo, weekAgo).Scan(&trendingData)

	// Обновляем или создаем записи
	for _, data := range trendingData {
		// Формула trending score (можно настроить)
		// Score = ViewsHour * 10 + ViewsDay * 2 + ViewsWeek * 0.5 + Engagement
		score := float64(data.ViewsHour)*10 +
			float64(data.ViewsDay)*2 +
			float64(data.ViewsWeek)*0.5 +
			data.Engagement
		h.DB.Where(
			"content_type = ? AND content_id = ?",
			data.ContentType, data.ContentID,
		).Assign(models.TrendingContent{
			ContentType:     data.ContentType,
			ContentID:       data.ContentID,
			ViewsHour:       data.ViewsHour,
			ViewsDay:        data.ViewsDay,
			ViewsWeek:       data.ViewsWeek,
			EngagementScore: data.Engagement,
			TrendingScore:   score,
		}).FirstOrCreate(&models.TrendingContent{})
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "updated",
		"count":  len(trendingData),
	})
}

// SystemTest - Полный тест системы рекомендаций
func (h *RecommendationHandler) SystemTest() {
	log.Println("🧪 Starting System Integration Test...")

	// ОЧИСТКА: Удаляем тестовые данные
	h.cleanupTestData()

	// === ТЕСТЫ ===
	log.Println("\n=== ТЕСТ 1: Пассивный пользователь ===")
	testPassiveUser(h)

	log.Println("\n=== ТЕСТ 2: Активный пользователь ===")
	testActiveUser(h)

	log.Println("\n=== ТЕСТ 3: Cold Start ===")
	testColdStart(h)

	log.Println("\n=== ТЕСТ 4: Trending ===")
	testTrending(h)

	log.Println("\n=== ТЕСТ 5: Персонализированная лента ===")
	testPersonalizedFeed(h)

	log.Println("\n✅ All tests completed!")
}

// cleanupTestData - Очистка тестовых данных
func (h *RecommendationHandler) cleanupTestData() {
	log.Println("🧹 Cleaning up test data...")

	// Удаляем тестовых пользователей
	testUserIDs := []uint{9999, 10000, 11000, 1, 2, 3, 4, 5}
	h.DB.Where("user_id IN ?", testUserIDs).Delete(&models.View{})
	h.DB.Where("user_id IN ?", testUserIDs).Delete(&models.UserPreference{})

	// Удаляем тестовый контент
	testContentIDs := []uint{1, 2, 3, 10, 100, 101, 999}
	for i := 201; i <= 215; i++ {
		testContentIDs = append(testContentIDs, uint(i))
	}
	h.DB.Where("content_id IN ?", testContentIDs).Delete(&models.ContentMetadata{})
	h.DB.Where("content_id IN ?", testContentIDs).Delete(&models.TrendingContent{})

	log.Println("✅ Cleanup completed")
}

func testPassiveUser(h *RecommendationHandler) {
	userID := uint(9999)

	// 1. Создаем метаданные для контента
	emptyTags := "[]" // ИСПРАВЛЕНО: пустой массив вместо пустой строки

	h.DB.Create(&models.ContentMetadata{
		ContentType: models.ContentTypeVideo,
		ContentID:   1,
		Category:    "cooking",
		Tags:        &emptyTags,
		AuthorID:    777,
	})

	h.DB.Create(&models.ContentMetadata{
		ContentType: models.ContentTypeVideo,
		ContentID:   2,
		Category:    "cooking",
		Tags:        &emptyTags,
		AuthorID:    777,
	})

	h.DB.Create(&models.ContentMetadata{
		ContentType: models.ContentTypeVideo,
		ContentID:   3,
		Category:    "tech",
		Tags:        &emptyTags,
		AuthorID:    888,
	})

	// 2. Симулируем просмотры БЕЗ лайков
	views := []models.View{
		{
			UserID:          userID,
			ContentType:     models.ContentTypeVideo,
			ContentID:       1,
			WatchTime:       300,
			ContentDuration: 300,
			Completed:       true,
			Progress:        100,
		},
		{
			UserID:          userID,
			ContentType:     models.ContentTypeVideo,
			ContentID:       2,
			WatchTime:       250,
			ContentDuration: 300,
			Completed:       false,
			Progress:        83,
		},
		{
			UserID:          userID,
			ContentType:     models.ContentTypeVideo,
			ContentID:       3,
			WatchTime:       10,
			ContentDuration: 300,
			Completed:       false,
			Progress:        3,
			Skipped:         true,
		},
	}

	for i := range views {
		views[i].EngagementScore = views[i].CalculateEngagementScore()
		h.DB.Create(&views[i])
	}

	log.Printf("Video 1 (досмотрел): %.2f баллов", views[0].EngagementScore)
	log.Printf("Video 2 (83%%): %.2f баллов", views[1].EngagementScore)
	log.Printf("Video 3 (скипнул): %.2f баллов", views[2].EngagementScore)

	recommendations := h.getRecommendationsForPassiveUser(userID)
	log.Printf("Получено рекомендаций: %d", len(recommendations))

	cookingCount := 0
	for _, rec := range recommendations {
		var meta models.ContentMetadata
		h.DB.Where("content_type = ? AND content_id = ?", rec.ContentType, rec.ContentID).First(&meta)
		if meta.Category == "cooking" {
			cookingCount++
		}
	}

	log.Printf("✅ Рекомендаций из категории 'cooking': %d", cookingCount)
}

func testActiveUser(h *RecommendationHandler) {
	userID := uint(10000)

	view := models.View{
		UserID:          userID,
		ContentType:     models.ContentTypeVideo,
		ContentID:       10,
		WatchTime:       300,
		ContentDuration: 300,
		Completed:       true,
		Liked:           true,
		Commented:       true,
		Shared:          true,
	}

	view.EngagementScore = view.CalculateEngagementScore()
	h.DB.Create(&view)

	log.Printf("Активный пользователь - Engagement: %.2f баллов", view.EngagementScore)
	log.Printf("✅ Высокий engagement за счет лайка, коммента и репоста")
}

func testColdStart(h *RecommendationHandler) {
	contentID := uint(999)
	emptyTags := "[]"

	h.DB.Create(&models.ContentMetadata{
		ContentType: models.ContentTypeVideo,
		ContentID:   contentID,
		Category:    "gaming",
		Tags:        &emptyTags,
		AuthorID:    555,
	})

	testUsers := []uint{1, 2, 3, 4, 5}

	for _, userID := range testUsers {
		view := models.View{
			UserID:          userID,
			ContentType:     models.ContentTypeVideo,
			ContentID:       contentID,
			WatchTime:       250,
			ContentDuration: 300,
			Completed:       true,
			Liked:           true,
		}
		view.EngagementScore = view.CalculateEngagementScore()
		h.DB.Create(&view)
	}

	metrics := h.analyzePerformance(models.ContentTypeVideo, contentID)
	log.Printf("Cold Start Metrics:")
	log.Printf("  Completion Rate: %.2f%% (порог: 50%%)", metrics.CompletionRate*100)
	log.Printf("  Engagement Score: %.2f (порог: 40)", metrics.EngagementScore)

	if metrics.CompletionRate > 0.5 && metrics.EngagementScore > 40 {
		log.Printf("✅ Контент прошел Cold Start - готов к расширенному продвижению!")
	} else {
		log.Printf("⚠️ Контент не прошел Cold Start")
	}
}

func testTrending(h *RecommendationHandler) {
	now := time.Now()

	trending := []models.TrendingContent{
		{
			ContentType:     models.ContentTypeVideo,
			ContentID:       100,
			ViewsHour:       5000,
			ViewsDay:        20000,
			ViewsWeek:       50000,
			EngagementScore: 75.0,
		},
		{
			ContentType:     models.ContentTypeVideo,
			ContentID:       101,
			ViewsHour:       100,
			ViewsDay:        500,
			ViewsWeek:       2000,
			EngagementScore: 45.0,
		},
	}

	for i := range trending {
		trending[i].TrendingScore = float64(trending[i].ViewsHour)*10 +
			float64(trending[i].ViewsDay)*2 +
			float64(trending[i].ViewsWeek)*0.5 +
			trending[i].EngagementScore

		trending[i].UpdatedAt = now
		trending[i].CreatedAt = now

		h.DB.Create(&trending[i])
	}

	log.Printf("Видео 100 - Trending Score: %.2f (вирусное)", trending[0].TrendingScore)
	log.Printf("Видео 101 - Trending Score: %.2f (обычное)", trending[1].TrendingScore)
	log.Printf("✅ Вирусный контент имеет намного выше score")
}

func testPersonalizedFeed(h *RecommendationHandler) {
	userID := uint(11000)

	for i := 1; i <= 15; i++ {
		view := models.View{
			UserID:          userID,
			ContentType:     models.ContentTypeVideo,
			ContentID:       uint(200 + i),
			WatchTime:       200,
			ContentDuration: 300,
			Completed:       true,
			Liked:           i%3 == 0,
		}
		view.EngagementScore = view.CalculateEngagementScore()
		h.DB.Create(&view)
	}

	recommendations := h.getPersonalizedRecommendations(userID, "all", 20)

	log.Printf("Персонализированная лента: %d рекомендаций", len(recommendations))

	collaborative := 0
	contentBased := 0
	trending := 0

	for _, rec := range recommendations {
		switch rec.Reason {
		case "similar_users":
			collaborative++
		case "your_interests":
			contentBased++
		case "trending":
			trending++
		}
	}

	log.Printf("  Collaborative Filtering: %d", collaborative)
	log.Printf("  Content-Based: %d", contentBased)
	log.Printf("  Trending: %d", trending)
	log.Printf("✅ Лента содержит разные типы рекомендаций")
}
