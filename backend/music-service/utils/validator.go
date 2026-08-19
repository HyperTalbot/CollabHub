package utils

import (
	"regexp"
	"strings"
)

// ValidateEmail проверяет корректность email
func ValidateEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// ValidateUsername проверяет корректность username
func ValidateUsername(username string) bool {
	// Username должен быть от 3 до 30 символов, только буквы, цифры, подчеркивание
	if len(username) < 3 || len(username) > 30 {
		return false
	}
	usernameRegex := regexp.MustCompile(`^[a-zA-Z0-9_]+$`)
	return usernameRegex.MatchString(username)
}

// ValidatePassword проверяет сложность пароля
func ValidatePassword(password string) bool {
	// Минимум 6 символов
	return len(password) >= 6
}

// SanitizeString очищает строку от опасных символов
func SanitizeString(input string) string {
	// Убираем лишние пробелы по краям
	input = strings.TrimSpace(input)
	// Убираем множественные пробелы
	space := regexp.MustCompile(`\s+`)
	input = space.ReplaceAllString(input, " ")
	return input
}

// ValidateTrackTitle проверяет название трека
func ValidateTrackTitle(title string) bool {
	title = SanitizeString(title)
	return len(title) >= 1 && len(title) <= 200
}

// ValidateArtistName проверяет имя исполнителя
func ValidateArtistName(artist string) bool {
	artist = SanitizeString(artist)
	return len(artist) >= 1 && len(artist) <= 100
}

// ValidatePlaylistName проверяет название плейлиста
func ValidatePlaylistName(name string) bool {
	name = SanitizeString(name)
	return len(name) >= 1 && len(name) <= 100
}

// ValidateCommentContent проверяет содержание комментария
func ValidateCommentContent(content string) bool {
	content = SanitizeString(content)
	return len(content) >= 1 && len(content) <= 1000
}

// ValidateURL проверяет корректность URL
func ValidateURL(url string) bool {
	urlRegex := regexp.MustCompile(`^https?://[^\s]+$`)
	return urlRegex.MatchString(url)
}
