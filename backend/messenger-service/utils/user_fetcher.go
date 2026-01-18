// // /backend/messenger-service/utils/user_fetcher.go
// package utils

// import (
// 	"encoding/json"
// 	"fmt"
// 	"net/http"
// )

// type UserResponse struct {
// 	ID       uint   `json:"id"`
// 	Username string `json:"username"`
// }

// func GetUsernameByID(userID uint) string {
// 	// Обращаемся к auth-service (порт 8080)
// 	authServiceURL := fmt.Sprintf("http://localhost:8080/api/v1/users/%d", userID)

// 	resp, err := http.Get(authServiceURL)
// 	if err != nil {
// 		fmt.Printf("Failed to fetch user %d: %v\n", userID, err)
// 		return ""
// 	}
// 	defer resp.Body.Close()

// 	if resp.StatusCode != http.StatusOK {
// 		return ""
// 	}

// 	var userResp UserResponse
// 	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
// 		return ""
// 	}

// 	return userResp.Username
// }

// backend/messenger-service/utils/user_fetcher.go
// ПОЛНОСТЬЮ ЗАМЕНИТЕ ФАЙЛ:

// package utils

// import (
// 	"encoding/json"
// 	"fmt"
// 	"net/http"
// 	"time"
// )

// type UserResponse struct {
// 	ID        uint   `json:"id"`
// 	Username  string `json:"username"`
// 	Email     string `json:"email"`
// 	AvatarURL string `json:"avatar_url"`
// }

// // Кэш пользователей (опционально, но полезно)
// var userCache = make(map[uint]*UserResponse)

// func GetUsernameByID(userID uint) string {
// 	// Проверяем кэш
// 	if cached, ok := userCache[userID]; ok {
// 		fmt.Printf("✅ Cache hit for user %d: %s\n", userID, cached.Username)
// 		return cached
// 	}

// 	// Обращаемся к auth-service (порт 8080)
// 	authServiceURL := fmt.Sprintf("http://localhost:8080/api/v1/users/%d", userID)

// 	client := &http.Client{Timeout: 3 * time.Second}
// 	resp, err := client.Get(authServiceURL)
// 	if err != nil {
// 		fmt.Printf("❌ Failed to fetch user %d: %v\n", userID, err)
// 		return fmt.Sprintf("User_%d", userID) // Fallback
// 	}
// 	defer resp.Body.Close()

// 	if resp.StatusCode != http.StatusOK {
// 		fmt.Printf("❌ User %d not found (status: %d)\n", userID, resp.StatusCode)
// 		return fmt.Sprintf("User_%d", userID)
// 	}

// 	var userResp UserResponse
// 	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
// 		fmt.Printf("❌ Failed to decode user %d: %v\n", userID, err)
// 		return fmt.Sprintf("User_%d", userID)
// 	}

// 	// Сохраняем в кэш
// 	userCache[userID] = &userResp

// 	fmt.Printf("✅ Fetched user: %d -> %s\n", userID, userResp.Username)
// 	return userResp.Username
// }

// // GetUserByID - Получить полные данные пользователя
// func GetUserByID(userID uint) *UserResponse {
// 	if cached, ok := userCache[userID]; ok {
// 		return cached
// 	}

// 	authServiceURL := fmt.Sprintf("http://localhost:8080/api/v1/users/%d", userID)

// 	client := &http.Client{Timeout: 3 * time.Second}
// 	resp, err := client.Get(authServiceURL)
// 	if err != nil {
// 		return &UserResponse{ID: userID, Username: fmt.Sprintf("User_%d", userID)}
// 	}
// 	defer resp.Body.Close()

// 	if resp.StatusCode != http.StatusOK {
// 		return &UserResponse{ID: userID, Username: fmt.Sprintf("User_%d", userID)}
// 	}

// 	var userResp UserResponse
// 	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
// 		return &UserResponse{ID: userID, Username: fmt.Sprintf("User_%d", userID)}
// 	}

// 	userCache[userID] = &userResp
// 	return &userResp
// }

// backend/messenger-service/utils/user_fetcher.go
// ПРОВЕРЬТЕ, ЧТО ЭТОТ КОД ЕСТЬ:

// package utils

// import (
// 	"encoding/json"
// 	"fmt"
// 	"net/http"
// 	"time"
// )

// type UserResponse struct {
// 	ID        uint   `json:"id"`
// 	Username  string `json:"username"`
// 	Email     string `json:"email"`
// 	AvatarURL string `json:"avatar_url"`
// }

// var userCache = make(map[uint]*UserResponse)

// func GetUserByID(userID uint) *UserResponse {
// 	// Проверяем кэш
// 	if cached, ok := userCache[userID]; ok {
// 		fmt.Printf("✅ Cache hit for user %d: %s\n", userID, cached.Username)
// 		return cached
// 	}

// 	// Запрос к auth-service
// 	authServiceURL := fmt.Sprintf("http://localhost:8080/api/v1/users/%d", userID)

// 	fmt.Printf("🔍 Fetching user %d from %s\n", userID, authServiceURL)

// 	client := &http.Client{Timeout: 5 * time.Second}
// 	resp, err := client.Get(authServiceURL)
// 	if err != nil {
// 		fmt.Printf("❌ HTTP Error fetching user %d: %v\n", userID, err)
// 		return &UserResponse{
// 			ID:       userID,
// 			Username: fmt.Sprintf("User_%d", userID),
// 		}
// 	}
// 	defer resp.Body.Close()

// 	if resp.StatusCode != http.StatusOK {
// 		fmt.Printf("❌ User %d not found, status: %d\n", userID, resp.StatusCode)
// 		return &UserResponse{
// 			ID:       userID,
// 			Username: fmt.Sprintf("User_%d", userID),
// 		}
// 	}

// 	var userResp UserResponse
// 	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
// 		fmt.Printf("❌ JSON decode error for user %d: %v\n", userID, err)
// 		return &UserResponse{
// 			ID:       userID,
// 			Username: fmt.Sprintf("User_%d", userID),
// 		}
// 	}

// 	// Сохраняем в кэш
// 	userCache[userID] = &userResp

// 	fmt.Printf("✅ Successfully fetched user %d: %s\n", userID, userResp.Username)

// 	return &userResp
// }

// func GetUsernameByID(userID uint) string {
// 	user := GetUserByID(userID)
// 	return user.Username
// }

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
// backend/messenger-service/utils/user_fetcher.go

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
