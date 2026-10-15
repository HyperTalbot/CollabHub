package handlers

import (
	"backend/auth-service/models"
	"backend/auth-service/utils"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AuthHandler "держит" в себе подключение к БД
type AuthHandler struct {
	DB *gorm.DB
}

// NewAuthHandler - "конструктор" для нашего обработчика
func NewAuthHandler(db *gorm.DB) *AuthHandler {
	return &AuthHandler{DB: db}
}

// Структура для входящих данных при регистрации
type RegisterInput struct {
	Username string `json:"username" binding:"required,min=3"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register (POST /api/v1/auth/register)
func (h *AuthHandler) Register(c *gin.Context) {
	var input RegisterInput

	// Проверяем и "привязываем" JSON к нашей структуре
	// binding:"required" - Gin автоматически проверит, что поля не пустые
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Хэшируем пароль
	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Создаем пользователя
	user := models.User{
		Username:     input.Username,
		Email:        input.Email,
		PasswordHash: hashedPassword,
	}

	// Сохраняем в БД
	result := h.DB.Create(&user)
	if result.Error != nil {
		// (Здесь нужна более умная обработка ошибок,
		// например, "username already exists")
		c.JSON(http.StatusConflict, gin.H{"error": result.Error.Error()})
		return
	}

	// Отвечаем успехом
	// (Помните, PasswordHash не будет отправлен благодаря json:"-")
	c.JSON(http.StatusCreated, user)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var input LoginInput

	// Валидация входных данных
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email or password format."})
		return
	}

	// Найти пользователя по Email
	var user models.User
	result := h.DB.Where("email = ?", input.Email).First(&user)

	if result.Error != nil {
		// Всегда возвращаем общую ошибку для безопасности
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials."})
		return
	}

	// Проверяем введенный пароль с хэшем, хранящимся в БД
	if !utils.CheckPasswordHash(input.Password, user.PasswordHash) {
		// Снова общая ошибка
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials."})
		return
	}

	// Генерируем JWT
	token, err := utils.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token."})
		return
	}

	// Успех! Отвечаем токеном и данными пользователя
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

func (h *AuthHandler) GetMe(c *gin.Context) {
	// Получаем UserID из контекста, установленного мидлваром
	userID, exists := c.Get("userID")
	if !exists {
		// Если мидлвар не сработал (чего быть не должно), возвращаем ошибку
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized access."})
		return
	}

	// Находи пользователей по ID
	var user models.User
	// GORM ищет по первичному ключу (ID)
	result := h.DB.First(&user, userID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found."})
		return
	}

	// Возвращаем данные пользователя
	c.JSON(http.StatusOK, user)
}

// ChangePassword (Если пользователь залогинен)
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, _ := c.Get("userID")
	var input struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Проверка старого пароля
	if !utils.CheckPasswordHash(input.OldPassword, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect old password"})
		return
	}

	// Хешируем новый
	newHash, _ := utils.HashPassword(input.NewPassword)
	h.DB.Model(&user).Update("password_hash", newHash)

	c.JSON(http.StatusOK, gin.H{"message": "Password updated"})
}

// ForgotPassword (Генерация токена)
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var input struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		// По безопасности лучше отвечать "Если email существует, мы отправили письмо"
		// Но для отладки пока вернем ошибку
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Генерируем случайный токен
	bytes := make([]byte, 16)
	rand.Read(bytes)
	token := hex.EncodeToString(bytes)

	// Сохраняем в БД (срок жизни 1 час)
	user.ResetToken = token
	user.ResetTokenExpires = time.Now().Add(1 * time.Hour)
	h.DB.Save(&user)

	// TODO: Здесь должна быть отправка Email (SMTP)
	// Пока выводим в консоль
	println("=====================================")
	println("RESET LINK: http://localhost:3000/reset-password?token=" + token)
	println("=====================================")

	c.JSON(http.StatusOK, gin.H{"message": "Reset link sent (check console)"})
}

// ResetPassword (Сброс по токену)
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var input struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	// Ищем юзера по токену и проверяем срок действия
	if err := h.DB.Where("reset_token = ? AND reset_token_expires > ?", input.Token, time.Now()).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired token"})
		return
	}

	// Обновляем пароль и очищаем токен
	newHash, _ := utils.HashPassword(input.NewPassword)
	user.PasswordHash = newHash
	user.ResetToken = ""
	h.DB.Save(&user)

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
}

// UpdateProfile - Обновление профиля (Аватар, Био)
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("userID")

	var input struct {
		DisplayName *string `json:"display_name"`
		AvatarURL   string  `json:"avatar_url"`
		CoverURL    string  `json:"cover_url"` // обложка
		Bio         string  `json:"bio"`
		Location    string  `json:"location"`
		Website     string  `json:"website"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// «Изменить контакт» в модалке чата: display_name обновляется всегда,
	// когда поле прислано (в т.ч. пустая строка — тогда fallback на username).
	if input.DisplayName != nil {
		name := strings.TrimSpace(*input.DisplayName)
		if name == "" {
			name = user.Username
		}
		user.DisplayName = name
	}

	// Обновляем только то, что прислали
	if input.AvatarURL != "" {
		user.AvatarURL = input.AvatarURL
	}
	if input.CoverURL != "" {
		user.CoverURL = input.CoverURL
	}
	if input.Bio != "" {
		user.Bio = input.Bio
	}
	if input.Location != "" {
		user.Location = input.Location
	}
	if input.Website != "" {
		user.Website = input.Website
	}

	h.DB.Save(&user)

	// Не возвращаем хэш пароля
	user.PasswordHash = ""
	c.JSON(http.StatusOK, user)
}
