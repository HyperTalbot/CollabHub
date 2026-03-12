// /backend/music-service/utils/jwt.go
package utils

import (
	"errors"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// Удаляем глобальную переменную jwtKey, так как она инициализируется слишком рано!

type Claims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"` // УБЕДИТЕСЬ ЧТО ЭТО ПОЛЕ ЕСТЬ
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func ParseToken(tokenString string) (*Claims, error) {
	// Считываем ключ ЗДЕСЬ, внутри функции, когда .env уже загружен
	jwtKey := []byte(os.Getenv("JWT_SECRET"))

	// Убираем префикс "Bearer ", если он есть
	if len(tokenString) > 7 && strings.ToUpper(tokenString[0:7]) == "BEARER " {
		tokenString = tokenString[7:]
	}

	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Проверка метода подписи
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtKey, nil
	})

	if err != nil {
		// Полезно для отладки: выводим ошибку в консоль, если это локальная разработка
		// fmt.Println("Token parse error:", err)
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
