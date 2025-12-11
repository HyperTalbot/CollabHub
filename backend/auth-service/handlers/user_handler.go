package handlers

import (
	"backend/auth-service/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type UserHandler struct {
	DB *gorm.DB
}

type UserResponse struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
}

func (h *UserHandler) GetUserByID(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, UserResponse{
		ID:       user.ID,
		Username: user.Username,
	})
}

// SearchUsers ищет пользователей по username
func (h *UserHandler) SearchUsers(c *gin.Context) {
	query := c.Query("q")
	if query == "" || len(query) < 2 {
		c.JSON(http.StatusOK, []UserResponse{}) // Пустой список, если запрос короткий
		return
	}

	var users []models.User
	// ILIKE для нечувствительности к регистру (PostgreSQL)
	// Для MySQL используйте LIKE
	if err := h.DB.Where("username ILIKE ?", "%"+query+"%").Limit(10).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
		return
	}

	var response []UserResponse
	for _, u := range users {
		response = append(response, UserResponse{
			ID:       u.ID,
			Username: u.Username,
		})
	}

	c.JSON(http.StatusOK, response)
}

// GetUsers - Список всех пользователей (с пагинацией и поиском)
func (h *UserHandler) GetAllUsers(c *gin.Context) {
	var users []models.User
	query := h.DB.Model(&models.User{})

	// Поиск
	if search := c.Query("q"); search != "" {
		query = query.Where("username ILIKE ? OR email ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// СОРТИРОВКА
	sortBy := c.DefaultQuery("sort_by", "id") // id, username, email, role
	order := c.DefaultQuery("order", "asc")   // asc, desc

	// Валидация полей для защиты от SQL-инъекций
	allowedSorts := map[string]bool{"id": true, "username": true, "email": true, "role": true}
	if !allowedSorts[sortBy] {
		sortBy = "id"
	}
	if order != "asc" && order != "desc" {
		order = "asc"
	}

	query = query.Order(sortBy + " " + order)

	// Пагинация
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	var total int64
	query.Count(&total)

	if err := query.Offset(offset).Limit(limit).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  users,
		"total": total,
		"page":  page,
	})
}

// AdminUpdateUser - Редактирование юзера админом
func (h *UserHandler) AdminUpdateUser(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Обновляем только непустые поля
	updateData := make(map[string]interface{})
	if input.Username != "" {
		updateData["username"] = input.Username
	}
	if input.Email != "" {
		updateData["email"] = input.Email
	}
	if input.Role != "" {
		updateData["role"] = input.Role
	}

	if err := h.DB.Model(&models.User{}).Where("id = ?", id).Updates(updateData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// UpdateUserRole - Повысить/Понизить (CRUD)
func (h *UserHandler) UpdateUserRole(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Role string `json:"role" binding:"required,oneof=user admin"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.DB.Model(&models.User{}).Where("id = ?", id).Update("role", input.Role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// DeleteUser - Удалить (Бан)
func (h *UserHandler) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	// Hard delete (или Soft delete, если настроен GORM)
	if err := h.DB.Delete(&models.User{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
