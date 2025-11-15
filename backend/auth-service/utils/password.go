package utils

import "golang.org/x/crypto/bcrypt"

// Хэшируем пароль
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14) // 14 - "стоимость" хэширования
	return string(bytes), err
}

// Проверяем пароль
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
