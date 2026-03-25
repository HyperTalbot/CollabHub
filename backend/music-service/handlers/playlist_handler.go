package handlers

import (
	"backend/music-service/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PlaylistHandler struct {
	DB *gorm.DB
}

// GetPlaylistByID - Получить плейлист по ID
func (h *PlaylistHandler) GetPlaylistByID(c *gin.Context) {
	id := c.Param("id")
	var playlist models.Playlist

	if err := h.DB.Preload("Tracks").First(&playlist, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	c.JSON(http.StatusOK, playlist)
}

// GetPublicPlaylists - Получить все публичные плейлисты
func (h *PlaylistHandler) GetPublicPlaylists(c *gin.Context) {
	var playlists []models.Playlist

	// Получаем только публичные плейлисты
	if err := h.DB.Where("is_public = ?", true).
		Preload("Tracks").
		Order("created_at DESC").
		Find(&playlists).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch playlists"})
		return
	}

	c.JSON(http.StatusOK, playlists)
}

// GetUserPlaylists - Получить плейлисты пользователя
func (h *PlaylistHandler) GetUserPlaylists(c *gin.Context) {
	userID := c.GetUint("user_id")

	var playlists []models.Playlist
	h.DB.Where("user_id = ?", userID).
		Preload("Tracks").
		Find(&playlists)

	c.JSON(http.StatusOK, playlists)
}

// CreatePlaylist - Создать новый плейлист
func (h *PlaylistHandler) CreatePlaylist(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		CoverURL    string `json:"cover_url"`
		IsPublic    bool   `json:"is_public"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	playlist := models.Playlist{
		Name:        input.Name,
		Description: input.Description,
		CoverURL:    input.CoverURL,
		UserID:      userID,
		IsPublic:    input.IsPublic,
	}

	if err := h.DB.Create(&playlist).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create playlist"})
		return
	}

	c.JSON(http.StatusCreated, playlist)
}

// UpdatePlaylist - Обновить плейлист
func (h *PlaylistHandler) UpdatePlaylist(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetUint("user_id")

	var playlist models.Playlist
	if err := h.DB.First(&playlist, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	if playlist.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var input struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		CoverURL    string `json:"cover_url"`
		IsPublic    *bool  `json:"is_public"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.Name != "" {
		updates["name"] = input.Name
	}
	if input.Description != "" {
		updates["description"] = input.Description
	}
	if input.CoverURL != "" {
		updates["cover_url"] = input.CoverURL
	}
	if input.IsPublic != nil {
		updates["is_public"] = *input.IsPublic
	}

	if err := h.DB.Model(&playlist).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update playlist"})
		return
	}

	c.JSON(http.StatusOK, playlist)
}

// DeletePlaylist - Удалить плейлист
func (h *PlaylistHandler) DeletePlaylist(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetUint("user_id")

	var playlist models.Playlist
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

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// AddTrackToPlaylist - Добавить трек в плейлист
func (h *PlaylistHandler) AddTrackToPlaylist(c *gin.Context) {
	playlistID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		TrackID uint `json:"track_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var playlist models.Playlist
	if err := h.DB.First(&playlist, playlistID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	if playlist.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var track models.Track
	if err := h.DB.First(&track, input.TrackID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track not found"})
		return
	}

	if err := h.DB.Model(&playlist).Association("Tracks").Append(&track); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add track"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "added"})
}

// RemoveTrackFromPlaylist - Удалить трек из плейлиста
func (h *PlaylistHandler) RemoveTrackFromPlaylist(c *gin.Context) {
	playlistID := c.Param("id")
	trackID := c.Param("trackId")
	userID := c.GetUint("user_id")

	var playlist models.Playlist
	if err := h.DB.First(&playlist, playlistID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	if playlist.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var track models.Track
	if err := h.DB.First(&track, trackID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track not found"})
		return
	}

	if err := h.DB.Model(&playlist).Association("Tracks").Delete(&track); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove track"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

// func mustParseUint(s string) uint {
// 	val, _ := strconv.ParseUint(s, 10, 32)
// 	return uint(val)
// }
