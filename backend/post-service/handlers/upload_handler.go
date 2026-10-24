package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

// UploadImage - Загружает файл на сервер
func UploadImage(c *gin.Context) {
	// Получаем файл из формы (ключ "file")
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Валидация размера (например, 5MB)
	if file.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 5MB)"})
		return
	}

	// Создаем папку uploads, если нет
	uploadPath := "./uploads"
	if _, err := os.Stat(uploadPath); os.IsNotExist(err) {
		os.Mkdir(uploadPath, 0755)
	}

	// Генерируем уникальное имя
	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
	dst := filepath.Join(uploadPath, filename)

	// Сохраняем
	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Возвращаем публичный URL
	// В проде здесь был бы домен, пока localhost
	url := fmt.Sprintf("http://localhost:8081/uploads/%s", filename)
	c.JSON(http.StatusOK, gin.H{"url": url})
}
