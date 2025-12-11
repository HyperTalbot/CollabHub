package utils

import (
	"errors"
	"os"

	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func getJWTSecret() ([]byte, error) {
	secret := os.Getenv("JWT_SECRET")

	if secret == "" {
		return nil, errors.New("JWT_SECRET is not set in .env file")
	}
	return []byte(secret), nil
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
