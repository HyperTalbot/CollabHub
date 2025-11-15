package handlers

import (
	"backend/auth-service/models"
	"backend/auth-service/utils"
	"net/http"

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
	token, err := utils.GenerateToken(user.ID, user.Username)
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
