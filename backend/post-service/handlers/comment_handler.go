package handlers

// backend/posts-service/handlers/comment_handler.go

import (
	"backend/post-service/models"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CommentHandler struct {
	DB *gorm.DB
}

func NewCommentHandler(db *gorm.DB) *CommentHandler {
	return &CommentHandler{DB: db}
}

type CreateCommentInput struct {
	Content  string `json:"content" binding:"required,min=1"`
	ParentID *uint  `json:"parent_id"` // может быть NULL
}

func (h *PostHandler) GetPostByID(c *gin.Context) {
	postID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	var post models.Post
	if err := h.DB.First(&post, postID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch post"})
		}
		return
	}

	// Здесь может быть логика для загрузки UserInfo, CommentsCount и Likes
	// Но пока просто возвращаем пост:
	c.JSON(http.StatusOK, post)
}

// GetCommentsByPost - Получить комментарии к конкретному посту
func (h *CommentHandler) GetCommentsByPost(c *gin.Context) {
	// 1. Получаем ID поста из URL
	postIDStr := c.Param("id")
	postID, err := strconv.ParseUint(postIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	// 2. Получаем (опционально) ID пользователя из мидлвара (повторяем логику GetPosts)
	userID_interface, exists := c.Get("userID")
	var userID uint
	if exists {
		switch v := userID_interface.(type) {
		case uint:
			userID = v
		case float64:
			userID = uint(v)
		case int:
			userID = uint(v)
		case int64:
			userID = uint(v)
		}
	}

	var comments []models.Comment
	// 3. Находим комментарии, отсортированные по дате создания
	if err := h.DB.Where("post_id = ?", postID).Order("created_at asc").Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve comments"})
		return
	}

	if len(comments) == 0 {
		c.JSON(http.StatusOK, []models.Comment{})
		return
	}

	// 4. Обогащение Комментариев Лайками (Аналогично GetPosts)
	commentIDs := make([]uint, len(comments))
	for i, comment := range comments {
		commentIDs[i] = comment.ID
	}

	var likes []models.CommentLike

	h.DB.Where("comment_id IN ?", commentIDs).Find(&likes)

	likesCountMap := make(map[uint]int64)
	userLikesMap := make(map[uint]bool)

	for _, like := range likes {
		likesCountMap[like.CommentID]++
		if userID > 0 && like.UserID == userID {
			userLikesMap[like.CommentID] = true
		}
	}

	for i := range comments {
		comments[i].LikesCount = likesCountMap[comments[i].ID]
		comments[i].IsLikedByMe = userLikesMap[comments[i].ID]
	}
	c.JSON(http.StatusOK, comments)
}

// CreateComment - Создать комментарий к посту
func (h *CommentHandler) CreateComment(c *gin.Context) {
	postIDStr := c.Param("id")
	postID, err := strconv.ParseUint(postIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	var input CreateCommentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	userID_interface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var userID uint
	switch v := userID_interface.(type) {
	case uint:
		userID = v
	case float64:
		userID = uint(v)
	case int64:
		userID = uint(v)
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	// Проверить, существует ли пост, прежде чем создавать комментарий
	var post models.Post
	if err := h.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	comment := models.Comment{
		PostID:   uint(postID),
		UserID:   userID,
		Content:  input.Content,
		ParentID: input.ParentID,
	}

	if err := h.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create comment"})
		return
	}

	// Возвращаем созданный комментарий с пустыми счетчиками
	comment.UserID = 0 // Сбрасываем, чтобы фронтенд его обновил
	c.JSON(http.StatusCreated, comment)
}

func (h *CommentHandler) LikeComment(c *gin.Context) {
	commentIDStr := c.Param("id")
	commentID, err := strconv.ParseUint(commentIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	// Безопасно получаем UserID
	userID_interface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var userID uint
	switch v := userID_interface.(type) {
	case uint:
		userID = v
	case float64:
		userID = uint(v)
	case int64:
		userID = uint(v)
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	// Проверка на существование коммент
	var comment models.Comment

	if err := h.DB.First(&comment, commentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	// Создаем лайк
	like := models.CommentLike{
		UserID:    userID,
		CommentID: uint(commentID),
	}

	if result := h.DB.Create(&like); result.Error != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Comment already liked"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Comment liked successfully"})
}

func (h *CommentHandler) UnlikeComment(c *gin.Context) {
	commentIDStr := c.Param("id")
	commentID, err := strconv.ParseUint(commentIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	userID_interface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var userID uint
	switch v := userID_interface.(type) {
	case uint:
		userID = v
	case float64:
		userID = uint(v)
	case int64:
		userID = uint(v)
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	result := h.DB.Where("user_id = ? AND comment_id = ?", userID, commentID).Delete(&models.CommentLike{})

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Like not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Comment unliked successfully"})
}
