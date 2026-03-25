// backend/video-service/handlers/playlist_handler.go
package handlers

import (
	"backend/video-service/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PlaylistHandler struct {
	DB *gorm.DB
}

// CreatePlaylist - Создать плейлист
func (h *PlaylistHandler) CreatePlaylist(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		Name         string `json:"name" binding:"required"`
		Description  string `json:"description"`
		ThumbnailURL string `json:"thumbnail_url"`
		IsPublic     bool   `json:"is_public"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	playlist := models.VideoPlaylist{
		Name:         req.Name,
		Description:  req.Description,
		ThumbnailURL: req.ThumbnailURL,
		UserID:       userID,
		IsPublic:     req.IsPublic,
	}

	if err := h.DB.Create(&playlist).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create playlist"})
		return
	}

	c.JSON(http.StatusCreated, playlist)
}

// GetUserPlaylists - Получить плейлисты пользователя
func (h *PlaylistHandler) GetUserPlaylists(c *gin.Context) {
	userID := c.GetUint("user_id")

	var playlists []models.VideoPlaylist
	if err := h.DB.Where("user_id = ?", userID).
		Preload("Videos").
		Order("created_at DESC").
		Find(&playlists).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch playlists"})
		return
	}

	c.JSON(http.StatusOK, playlists)
}

// GetPlaylistByID - Получить плейлист по ID
func (h *PlaylistHandler) GetPlaylistByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid playlist ID"})
		return
	}

	var playlist models.VideoPlaylist
	if err := h.DB.Preload("Videos").First(&playlist, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	c.JSON(http.StatusOK, playlist)
}

// GetPublicPlaylists - Получить все публичные плейлисты
func (h *PlaylistHandler) GetPublicPlaylists(c *gin.Context) {
	var playlists []models.VideoPlaylist

	if err := h.DB.Where("is_public = ?", true).
		Preload("Videos").
		Order("created_at DESC").
		Find(&playlists).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch playlists"})
		return
	}

	c.JSON(http.StatusOK, playlists)
}

// AddVideoToPlaylist - Добавить видео в плейлист
func (h *PlaylistHandler) AddVideoToPlaylist(c *gin.Context) {
	playlistID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid playlist ID"})
		return
	}

	userID := c.GetUint("user_id")

	var req struct {
		VideoID uint `json:"video_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var playlist models.VideoPlaylist
	if err := h.DB.First(&playlist, playlistID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	if playlist.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var video models.Video
	if err := h.DB.First(&video, req.VideoID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Video not found"})
		return
	}

	if err := h.DB.Model(&playlist).Association("Videos").Append(&video); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add video"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Video added"})
}

// RemoveVideoFromPlaylist - Удалить видео из плейлиста
func (h *PlaylistHandler) RemoveVideoFromPlaylist(c *gin.Context) {
	playlistID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid playlist ID"})
		return
	}

	videoID, err := strconv.ParseUint(c.Param("videoId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid video ID"})
		return
	}

	userID := c.GetUint("user_id")

	var playlist models.VideoPlaylist
	if err := h.DB.First(&playlist, playlistID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	if playlist.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var video models.Video
	if err := h.DB.First(&video, videoID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Video not found"})
		return
	}

	if err := h.DB.Model(&playlist).Association("Videos").Delete(&video); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove video"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Video removed"})
}

// DeletePlaylist - Удалить плейлист
func (h *PlaylistHandler) DeletePlaylist(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid playlist ID"})
		return
	}

	userID := c.GetUint("user_id")

	var playlist models.VideoPlaylist
	if err := h.DB.First(&playlist, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	if playlist.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := h.DB.Delete(&playlist).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete playlist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Playlist deleted"})
}
