// /backend/messenger-service/utils/user_fetcher.go

package utils

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type UserResponse struct {
	ID          uint   `json:"id"`
	Username    string `json:"username"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
}

type UserSearchResult struct {
	ID          uint   `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
}

var userCache = make(map[uint]*UserResponse)

func GetUserByID(userID uint) *UserResponse {
	if cached, ok := userCache[userID]; ok {
		return cached
	}

	authServiceURL := fmt.Sprintf("http://localhost:8080/api/v1/users/%d", userID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(authServiceURL)
	if err != nil {
		return &UserResponse{
			ID:       userID,
			Username: fmt.Sprintf("User_%d", userID),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &UserResponse{
			ID:       userID,
			Username: fmt.Sprintf("User_%d", userID),
		}
	}

	var userResp UserResponse
	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
		return &UserResponse{
			ID:       userID,
			Username: fmt.Sprintf("User_%d", userID),
		}
	}

	userCache[userID] = &userResp
	return &userResp
}

func GetUsernameByID(userID uint) string {
	user := GetUserByID(userID)
	return user.Username
}

// SearchUsers - Поиск пользователей через auth-service
func SearchUsers(query string) []UserSearchResult {
	authServiceURL := fmt.Sprintf("http://localhost:8080/api/v1/users/search?q=%s", query)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(authServiceURL)
	if err != nil {
		fmt.Printf("❌ Failed to search users: %v\n", err)
		return []UserSearchResult{}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return []UserSearchResult{}
	}

	// ИСПРАВЛЕНО: парсим массив напрямую
	var results []UserSearchResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		fmt.Printf("❌ Failed to parse search results: %v\n", err)
		return []UserSearchResult{}
	}

	return results
}

// InvalidateUserCache сбрасывает кэш пользователя, чтобы свежие данные
// (например, изменённый display_name) подтянулись из auth-service.
func InvalidateUserCache(userID uint) {
delete(userCache, userID)
}
