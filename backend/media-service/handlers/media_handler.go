// backend/media-service/handlers/media_handler.go
package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type MediaHandler struct{}

type UploadResponse struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
	Type     string `json:"type"`
}

// UploadImage - Загрузка изображений
func (h *MediaHandler) UploadImage(c *gin.Context) {
	h.uploadMedia(c, "image", []string{".jpg", ".jpeg", ".png", ".gif", ".webp"}, 10*1024*1024) // 10MB
}

// UploadVideo - Загрузка видео
func (h *MediaHandler) UploadVideo(c *gin.Context) {
	h.uploadMedia(c, "video", []string{".mp4", ".avi", ".mov", ".mkv", ".webm"}, 100*1024*1024) // 100MB
}

// UploadAudio - Загрузка аудио
func (h *MediaHandler) UploadAudio(c *gin.Context) {
	h.uploadMedia(c, "audio", []string{".mp3", ".wav", ".ogg", ".m4a"}, 50*1024*1024) // 50MB
}

// UploadFile - Загрузка любых файлов
func (h *MediaHandler) UploadFile(c *gin.Context) {
	h.uploadMedia(c, "file", []string{}, 50*1024*1024) // 50MB
}

// uploadMedia - Общая логика загрузки
func (h *MediaHandler) uploadMedia(c *gin.Context, mediaType string, allowedExts []string, maxSize int64) {
	userID := c.GetUint("user_id")

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File is required"})
		return
	}

	// Проверка размера
	if file.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("File too large. Max size: %dMB", maxSize/(1024*1024)),
		})
		return
	}

	// Проверка расширения
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if len(allowedExts) > 0 {
		allowed := false
		for _, allowedExt := range allowedExts {
			if ext == allowedExt {
				allowed = true
				break
			}
		}
		if !allowed {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Invalid file type. Allowed: %v", allowedExts),
			})
			return
		}
	}

	// Создаем папку uploads/{type}
	uploadDir := filepath.Join("uploads", mediaType)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Генерируем уникальное имя файла
	filename := fmt.Sprintf("%d_%d%s", time.Now().Unix(), userID, ext)
	filePath := filepath.Join(uploadDir, filename)

	// Сохраняем файл
	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Формируем URL для доступа
	fileURL := fmt.Sprintf("http://localhost:8087/uploads/%s/%s", mediaType, filename)

	c.JSON(http.StatusOK, UploadResponse{
		URL:      fileURL,
		Filename: filename,
		Size:     file.Size,
		Type:     mediaType,
	})
}

// GetMedia - Получение медиа файла
func (h *MediaHandler) GetMedia(c *gin.Context) {
	filename := c.Param("filename")

	// Ищем файл во всех папках
	mediaTypes := []string{"image", "video", "audio", "file"}

	for _, mediaType := range mediaTypes {
		filePath := filepath.Join("uploads", mediaType, filename)
		if _, err := os.Stat(filePath); err == nil {
			c.File(filePath)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
}
