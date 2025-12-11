// utils/token.go
package utils

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Структура для полезной нагрузки (Payload) JWT
// Мы хотим хранить ID и Username пользователя в токене
type JWTClaims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// Secret key для подписи токенов. Должен быть в .env и ОЧЕНЬ длинным!
// var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

func getJWTSecret() ([]byte, error) {
	secret := os.Getenv("JWT_SECRET")

	if secret == "" {
		return nil, errors.New("JWT_SECRET is not set in .env file")
	}
	return []byte(secret), nil
}

// GenerateToken создает новый JWT для пользователя
func GenerateToken(userID uint, username string, role string) (string, error) {
	// Если секретный ключ не установлен (например, в .env), произойдет ошибка

	jwtSecret, err := getJWTSecret()
	if err != nil {
		return "", err
	}

	// if len(jwtSecret) == 0 {
	// 	return "", errors.New("JWT_SECRET is not set in .env file")
	// }

	expirationTime := time.Now().Add(24 * time.Hour) // Токен действителен 24 часа

	claims := &JWTClaims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "CollabHub Auth Service", // Название вашего сервиса
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Подписываем токен нашим секретным ключом
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

func ParseToken(tokenString string) (*JWTClaims, error) {
	claims := &JWTClaims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		jwtSecret, err := getJWTSecret()
		if err != nil {
			// Если ключа нет, выдаем ошибку
			return nil, err
		}
		// Проверяем, что используется ожидаемый метод подписи
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return jwtSecret, nil // Возвращаем ключ
	})

	// if err != nil || !token.Valid {
	// 	return nil, jwt.ErrInvalidKey
	// }

	if err != nil {
		// Если была ошибка (например "token is expired"), просто возвращаем ее
		return nil, err
	}
	if !token.Valid {
		// Если ошибки не было, но токен все равно невалидный
		return nil, errors.New("token is invalid")
	}

	return claims, nil
}
