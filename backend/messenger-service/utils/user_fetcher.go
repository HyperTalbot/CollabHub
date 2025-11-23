// /backend/messenger-service/utils/user_fetcher.go
package utils

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type UserResponse struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
}

func GetUsernameByID(userID uint) string {
	// Обращаемся к auth-service (порт 8080)
	authServiceURL := fmt.Sprintf("http://localhost:8080/api/v1/users/%d", userID)

	resp, err := http.Get(authServiceURL)
	if err != nil {
		fmt.Printf("Failed to fetch user %d: %v\n", userID, err)
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ""
	}

	var userResp UserResponse
	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
		return ""
	}

	return userResp.Username
}
