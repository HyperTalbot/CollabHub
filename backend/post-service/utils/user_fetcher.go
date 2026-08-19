package utils

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type UserResponse struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	AvatarUrl string `json:"avatar_url"` // НОВОЕ: аватар пользователя (если auth-service его отдаёт)
}

// fetchUserByID — общий запрос к auth-service за данными пользователя
func fetchUserByID(userID uint) *UserResponse {
	// Используем localhost потому что сервисы на одной машине
	// В Kubernetes это было бы "http://auth-service/api/v1/users/"
	authServiceURL := fmt.Sprintf("http://localhost:8080/api/v1/users/%d", userID)
	resp, err := http.Get(authServiceURL)
	if err != nil {
		fmt.Printf("Failed to fetch user %d: %v\n", userID, err)
		return nil // Возвращаем nil при ошибке
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Auth service returned status %d for user %d\n", resp.StatusCode, userID)
		return nil
	}

	var userResp UserResponse
	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
		fmt.Printf("Failed to decode user response: %v\n", err)
		return nil
	}
	return &userResp
}

// GetUsernameByID — имя пользователя (сигнатура сохранена для совместимости)
func GetUsernameByID(userID uint) string {
	if u := fetchUserByID(userID); u != nil {
		return u.Username
	}
	return "" // Возвращаем пустую строку при ошибке
}

// GetUserAvatarByID — НОВОЕ: URL аватарки пользователя (пустая строка при ошибке)
func GetUserAvatarByID(userID uint) string {
	if u := fetchUserByID(userID); u != nil {
		return u.AvatarUrl
	}
	return ""
}

// GetUserByID — НОВОЕ: один запрос вместо двух (имя + аватар сразу)
func GetUserByID(userID uint) *UserResponse {
	return fetchUserByID(userID)
}