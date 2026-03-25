// backend/video-service/handlers/like_handler.go
package handlers

import (
	"backend/video-service/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LikeHandler struct {
	DB *gorm.DB
}

// LikeVideo - Лайк видео
func (h *LikeHandler) LikeVideo(c *gin.Context) {
	videoID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid video ID"})
		return
	}

	userID := c.GetUint("user_id")

	// ИСПРАВЛЕНО: используем Find вместо First
	var existing []models.VideoLike
	h.DB.Where("user_id = ? AND video_id = ?", userID, videoID).Limit(1).Find(&existing)

	tx := h.DB.Begin()

	if len(existing) == 0 {
		// Создаем новый лайк
		like := models.VideoLike{
			UserID:  userID,
			VideoID: uint(videoID),
			IsLike:  true,
		}
		if err := tx.Create(&like).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to like video"})
			return
		}
		tx.Model(&models.Video{}).Where("id = ?", videoID).UpdateColumn("like_count", gorm.Expr("like_count + ?", 1))
	} else {
		// Обновляем существующий
		if existing[0].IsLike {
			// Убираем лайк
			tx.Delete(&existing[0])
			tx.Model(&models.Video{}).Where("id = ?", videoID).UpdateColumn("like_count", gorm.Expr("like_count - ?", 1))
		} else {
			// Меняем дизлайк на лайк
			tx.Model(&existing[0]).Update("is_like", true)
			tx.Model(&models.Video{}).Where("id = ?", videoID).
				UpdateColumn("like_count", gorm.Expr("like_count + ?", 1)).
				UpdateColumn("dislike_count", gorm.Expr("dislike_count - ?", 1))
		}
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Success"})
}

// DislikeVideo - Дизлайк видео
func (h *LikeHandler) DislikeVideo(c *gin.Context) {
	videoID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid video ID"})
		return
	}

	userID := c.GetUint("user_id")

	// ИСПРАВЛЕНО: используем Find вместо First
	var existing []models.VideoLike
	h.DB.Where("user_id = ? AND video_id = ?", userID, videoID).Limit(1).Find(&existing)

	tx := h.DB.Begin()

	if len(existing) == 0 {
		// Создаем новый дизлайк
		like := models.VideoLike{
			UserID:  userID,
			VideoID: uint(videoID),
			IsLike:  false,
		}
		if err := tx.Create(&like).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to dislike video"})
			return
		}
		tx.Model(&models.Video{}).Where("id = ?", videoID).UpdateColumn("dislike_count", gorm.Expr("dislike_count + ?", 1))
	} else {
		if !existing[0].IsLike {
			// Убираем дизлайк
			tx.Delete(&existing[0])
			tx.Model(&models.Video{}).Where("id = ?", videoID).UpdateColumn("dislike_count", gorm.Expr("dislike_count - ?", 1))
		} else {
			// Меняем лайк на дизлайк
			tx.Model(&existing[0]).Update("is_like", false)
			tx.Model(&models.Video{}).Where("id = ?", videoID).
				UpdateColumn("dislike_count", gorm.Expr("dislike_count + ?", 1)).
				UpdateColumn("like_count", gorm.Expr("like_count - ?", 1))
		}
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Success"})
}

// GetUserLikeStatus - Получить статус лайка пользователя
func (h *LikeHandler) GetUserLikeStatus(c *gin.Context) {
	videoID, err := strconv.ParseUint(c.Param("id"), 10, 32)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid video ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusOK, gin.H{"liked": false, "disliked": false})
		return
	}

	// ИСПРАВЛЕНО: используем Find вместо First
	var likes []models.VideoLike
	h.DB.Where("user_id = ? AND video_id = ?", userID, videoID).Limit(1).Find(&likes)

	if len(likes) == 0 {
		c.JSON(http.StatusOK, gin.H{"liked": false, "disliked": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"liked": likes[0].IsLike, "disliked": !likes[0].IsLike})
}
