// backend/music-service/handlers/track_handler.go
package handlers

import (
	"backend/music-service/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TrackHandler struct {
	DB *gorm.DB
}

func getUserID(c *gin.Context) (uint, bool) {
	id, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}
	userID, ok := id.(uint)
	return userID, ok
}

// GetGenres - Получить список жанров
func (h *TrackHandler) GetGenres(c *gin.Context) {
	var genres []string
	h.DB.Model(&models.Track{}).Distinct().Pluck("genre", &genres)
	c.JSON(http.StatusOK, genres)
}

// GetQuickPicks - Быстрый выбор (популярные треки)
func (h *TrackHandler) GetQuickPicks(c *gin.Context) {
	var tracks []models.Track
	h.DB.Order("play_count DESC").Limit(10).Find(&tracks)
	c.JSON(http.StatusOK, tracks)
}

// GetRecommendedTracks - Рекомендованные треки
func (h *TrackHandler) GetRecommendedTracks(c *gin.Context) {
	userID, _ := getUserID(c)

	var tracks []models.Track

	if userID > 0 {
		// Рекомендации на основе истории прослушивания
		h.DB.Raw(`
   SELECT DISTINCT t.* FROM tracks t
   JOIN listening_history lh ON t.id = lh.track_id
   WHERE lh.user_id = ?
   ORDER BY lh.played_at DESC
   LIMIT 20
  , userID`).Scan(&tracks)
	}

	// Если рекомендаций мало, добавляем популярные
	if len(tracks) < 10 {
		h.DB.Order("play_count DESC").Limit(20).Find(&tracks)
	}

	c.JSON(http.StatusOK, tracks)
}

// GetRecommendedPlaylists - Рекомендованные плейлисты
func (h *TrackHandler) GetRecommendedPlaylists(c *gin.Context) {
	var playlists []models.Playlist
	h.DB.Where("is_public = ?", true).
		Preload("Tracks").
		Order("created_at DESC").
		Limit(10).
		Find(&playlists)

	c.JSON(http.StatusOK, playlists)
}

// GetTrackByID - Получить трек по ID
func (h *TrackHandler) GetTrackByID(c *gin.Context) {
	id := c.Param("id")
	var track models.Track

	if err := h.DB.First(&track, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track not found"})
		return
	}

	c.JSON(http.StatusOK, track)
}

// IncrementPlayCount - Увеличить счетчик прослушиваний
func (h *TrackHandler) IncrementPlayCount(c *gin.Context) {
	trackID := c.Param("id")
	userID, hasAuth := getUserID(c)

	// Увеличиваем счетчик
	h.DB.Model(&models.Track{}).Where("id = ?", trackID).
		UpdateColumn("play_count", gorm.Expr("play_count + 1"))

	// Если пользователь авторизован, добавляем в историю
	if hasAuth {
		history := models.ListeningHistory{
			UserID:   userID,
			TrackID:  uint(mustParseUint(trackID)),
			PlayedAt: time.Now(),
		}
		h.DB.Create(&history)
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// LikeTrack - Лайкнуть трек
func (h *TrackHandler) LikeTrack(c *gin.Context) {
	trackID := c.Param("id")
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	like := models.TrackLike{
		UserID:  userID,
		TrackID: uint(mustParseUint(trackID)),
	}

	if err := h.DB.Create(&like).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Already liked"})
		return
	}

	// Увеличиваем счетчик лайков
	h.DB.Model(&models.Track{}).Where("id = ?", trackID).
		UpdateColumn("likes_count", gorm.Expr("likes_count + 1"))

	c.JSON(http.StatusOK, gin.H{"status": "liked"})
}

// UnlikeTrack - Убрать лайк
func (h *TrackHandler) UnlikeTrack(c *gin.Context) {
	trackID := c.Param("id")
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	result := h.DB.Where("user_id = ? AND track_id = ?", userID, trackID).
		Delete(&models.TrackLike{})

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Like not found"})
		return
	}

	// Уменьшаем счетчик
	h.DB.Model(&models.Track{}).Where("id = ?", trackID).
		UpdateColumn("likes_count", gorm.Expr("likes_count - 1"))

	c.JSON(http.StatusOK, gin.H{"status": "unliked"})
}

// GetSimilarTracks - Получить похожие треки
func (h *TrackHandler) GetSimilarTracks(c *gin.Context) {
	id := c.Param("id")

	var track models.Track
	if err := h.DB.First(&track, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track not found"})
		return
	}

	var similar []models.Track
	h.DB.Where("genre = ? AND id != ?", track.Genre, id).
		Order("play_count DESC").
		Limit(10).
		Find(&similar)

	c.JSON(http.StatusOK, similar)
}

// SearchTracks - Поиск треков
func (h *TrackHandler) SearchTracks(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query required"})
		return
	}

	var tracks []models.Track
	h.DB.Where("title ILIKE ? OR artist ILIKE ?", "%"+query+"%", "%"+query+"%").
		Limit(50).
		Find(&tracks)

	c.JSON(http.StatusOK, tracks)
}

func mustParseUint(s string) uint {
	val, _ := strconv.ParseUint(s, 10, 32)
	return uint(val)
}
