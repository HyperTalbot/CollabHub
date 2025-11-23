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
	// Используем localhost потому что сервисы на одной машине
	// В Kubernetes это было бы "http://auth-service/api/v1/users/"
	authServiceURL := fmt.Sprintf("http://localhost:8080/api/v1/users/%d", userID)

	resp, err := http.Get(authServiceURL)
	if err != nil {
		fmt.Printf("Failed to fetch user %d: %v\n", userID, err)
		return "" // Возвращаем пустую строку при ошибке
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Auth service returned status %d for user %d\n", resp.StatusCode, userID)
		return ""
	}

	var userResp UserResponse
	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
		fmt.Printf("Failed to decode user response: %v\n", err)
		return ""
	}

	return userResp.Username
}
