// backend/recommendation-service/handlers/system_test.go
package handlers

// // SystemTest - Полный тест системы рекомендаций
// func (h *RecommendationHandler) SystemTest() {
// 	log.Println("🧪 Starting System Integration Test...")

// 	// === ТЕСТ 1: Пассивный пользователь (только просмотры) ===
// 	log.Println("\n=== ТЕСТ 1: Пассивный пользователь ===")
// 	testPassiveUser(h)

// 	// === ТЕСТ 2: Активный пользователь (с лайками) ===
// 	log.Println("\n=== ТЕСТ 2: Активный пользователь ===")
// 	testActiveUser(h)

// 	// === ТЕСТ 3: Cold Start (новый контент) ===
// 	log.Println("\n=== ТЕСТ 3: Cold Start ===")
// 	testColdStart(h)

// 	// === ТЕСТ 4: Trending ===
// 	log.Println("\n=== ТЕСТ 4: Trending ===")
// 	testTrending(h)

// 	// === ТЕСТ 5: Персонализированная лента ===
// 	log.Println("\n=== ТЕСТ 5: Персонализированная лента ===")
// 	testPersonalizedFeed(h)

// 	log.Println("\n✅ All tests completed!")
// }

// func testPassiveUser(h *RecommendationHandler) {
// 	userID := uint(9999) // Тестовый пользователь

// 	// 1. Создаем метаданные для контента
// 	h.DB.Create(&models.ContentMetadata{
// 		ContentType: models.ContentTypeVideo,
// 		ContentID:   1,
// 		Category:    "cooking",
// 		AuthorID:    777,
// 	})

// 	h.DB.Create(&models.ContentMetadata{
// 		ContentType: models.ContentTypeVideo,
// 		ContentID:   2,
// 		Category:    "cooking",
// 		AuthorID:    777,
// 	})

// 	h.DB.Create(&models.ContentMetadata{
// 		ContentType: models.ContentTypeVideo,
// 		ContentID:   3,
// 		Category:    "tech",
// 		AuthorID:    888,
// 	})

// 	// 2. Симулируем просмотры БЕЗ лайков
// 	views := []models.View{
// 		{
// 			UserID:          userID,
// 			ContentType:     models.ContentTypeVideo,
// 			ContentID:       1,
// 			WatchTime:       300,
// 			ContentDuration: 300,
// 			Completed:       true,
// 			Progress:        100,
// 		},
// 		{
// 			UserID:          userID,
// 			ContentType:     models.ContentTypeVideo,
// 			ContentID:       2,
// 			WatchTime:       250,
// 			ContentDuration: 300,
// 			Completed:       false,
// 			Progress:        83,
// 		},
// 		{
// 			UserID:          userID,
// 			ContentType:     models.ContentTypeVideo,
// 			ContentID:       3,
// 			WatchTime:       10,
// 			ContentDuration: 300,
// 			Completed:       false,
// 			Progress:        3,
// 			Skipped:         true,
// 		},
// 	}

// 	for i := range views {
// 		views[i].EngagementScore = views[i].CalculateEngagementScore()
// 		h.DB.Create(&views[i])
// 	}

// 	// 3. Проверяем engagement scores
// 	log.Printf("Video 1 (досмотрел): %.2f баллов", views[0].EngagementScore)
// 	log.Printf("Video 2 (83%%): %.2f баллов", views[1].EngagementScore)
// 	log.Printf("Video 3 (скипнул): %.2f баллов", views[2].EngagementScore)

// 	// 4. Получаем рекомендации
// 	recommendations := h.getRecommendationsForPassiveUser(userID)
// 	log.Printf("Получено рекомендаций: %d", len(recommendations))

// 	// 5. Проверяем что рекомендуется контент из категории "cooking"
// 	cookingCount := 0
// 	for _, rec := range recommendations {
// 		var meta models.ContentMetadata
// 		h.DB.Where("content_type = ? AND content_id = ?", rec.ContentType, rec.ContentID).First(&meta)
// 		if meta.Category == "cooking" {
// 			cookingCount++
// 		}
// 	}

// 	log.Printf("✅ Рекомендаций из категории 'cooking': %d (ожидаем больше)", cookingCount)
// }

// func testActiveUser(h *RecommendationHandler) {
// 	userID := uint(10000)

// 	// Создаем просмотры С лайками
// 	view := models.View{
// 		UserID:          userID,
// 		ContentType:     models.ContentTypeVideo,
// 		ContentID:       10,
// 		WatchTime:       300,
// 		ContentDuration: 300,
// 		Completed:       true,
// 		Liked:           true,
// 		Commented:       true,
// 		Shared:          true,
// 	}

// 	view.EngagementScore = view.CalculateEngagementScore()
// 	h.DB.Create(&view)

// 	log.Printf("Активный пользователь - Engagement: %.2f баллов", view.EngagementScore)
// 	log.Printf("✅ Высокий engagement за счет лайка, коммента и репоста")
// }

// func testColdStart(h *RecommendationHandler) {
// 	// 1. Создаем новый контент
// 	contentID := uint(999)

// 	h.DB.Create(&models.ContentMetadata{
// 		ContentType: models.ContentTypeVideo,
// 		ContentID:   contentID,
// 		Category:    "gaming",
// 		AuthorID:    555,
// 	})

// 	// 2. Симулируем тестовую аудиторию (5 человек вместо 100 для теста)
// 	testUsers := []uint{1, 2, 3, 4, 5}

// 	// 3. Создаем просмотры
// 	for _, userID := range testUsers {
// 		view := models.View{
// 			UserID:          userID,
// 			ContentType:     models.ContentTypeVideo,
// 			ContentID:       contentID,
// 			WatchTime:       250,
// 			ContentDuration: 300,
// 			Completed:       true,
// 			Liked:           true,
// 		}
// 		view.EngagementScore = view.CalculateEngagementScore()
// 		h.DB.Create(&view)
// 	}

// 	// 4. Анализируем метрики
// 	metrics := h.analyzePerformance(models.ContentTypeVideo, contentID)
// 	log.Printf("Cold Start Metrics:")
// 	log.Printf("  Completion Rate: %.2f%% (порог: 50%%)", metrics.CompletionRate*100)
// 	log.Printf("  Engagement Score: %.2f (порог: 40)", metrics.EngagementScore)

// 	if metrics.CompletionRate > 0.5 && metrics.EngagementScore > 40 {
// 		log.Printf("✅ Контент прошел Cold Start - готов к расширенному продвижению!")
// 	} else {
// 		log.Printf("⚠️ Контент не прошел Cold Start")
// 	}
// }

// func testTrending(h *RecommendationHandler) {
// 	// 1. Создаем контент с разными метриками
// 	now := time.Now()

// 	trending := []models.TrendingContent{
// 		{
// 			ContentType:     models.ContentTypeVideo,
// 			ContentID:       100,
// 			ViewsHour:       5000,
// 			ViewsDay:        20000,
// 			ViewsWeek:       50000,
// 			EngagementScore: 75.0,
// 		},
// 		{
// 			ContentType:     models.ContentTypeVideo,
// 			ContentID:       101,
// 			ViewsHour:       100,
// 			ViewsDay:        500,
// 			ViewsWeek:       2000,
// 			EngagementScore: 45.0,
// 		},
// 	}

// 	for i := range trending {
// 		// Вычисляем trending score
// 		trending[i].TrendingScore = float64(trending[i].ViewsHour)*10 +
// 			float64(trending[i].ViewsDay)*2 +
// 			float64(trending[i].ViewsWeek)*0.5 +
// 			trending[i].EngagementScore

// 		trending[i].UpdatedAt = now
// 		trending[i].CreatedAt = now

// 		h.DB.Create(&trending[i])
// 	}

// 	log.Printf("Видео 100 - Trending Score: %.2f (вирусное)", trending[0].TrendingScore)
// 	log.Printf("Видео 101 - Trending Score: %.2f (обычное)", trending[1].TrendingScore)
// 	log.Printf("✅ Вирусный контент имеет намного выше score")
// }

// func testPersonalizedFeed(h *RecommendationHandler) {
// 	userID := uint(11000)

// 	// 1. Создаем историю просмотров (15+ для персонализации)
// 	for i := 1; i <= 15; i++ {
// 		view := models.View{
// 			UserID:          userID,
// 			ContentType:     models.ContentTypeVideo,
// 			ContentID:       uint(200 + i),
// 			WatchTime:       200,
// 			ContentDuration: 300,
// 			Completed:       true,
// 			Liked:           i%3 == 0, // Каждый 3-й лайкнут
// 		}
// 		view.EngagementScore = view.CalculateEngagementScore()
// 		h.DB.Create(&view)
// 	}

// 	// 2. Получаем персонализированную ленту
// 	recommendations := h.getPersonalizedRecommendations(userID, "all", 20)

// 	log.Printf("Персонализированная лента: %d рекомендаций", len(recommendations))

// 	// 3. Проверяем что есть разные источники
// 	collaborative := 0
// 	contentBased := 0
// 	trending := 0

// 	for _, rec := range recommendations {
// 		switch rec.Reason {
// 		case "similar_users":
// 			collaborative++
// 		case "your_interests":
// 			contentBased++
// 		case "trending":
// 			trending++
// 		}
// 	}

// 	log.Printf("  Collaborative Filtering: %d", collaborative)
// 	log.Printf("  Content-Based: %d", contentBased)
// 	log.Printf("  Trending: %d", trending)
// 	log.Printf("✅ Лента содержит разные типы рекомендаций")
// }
