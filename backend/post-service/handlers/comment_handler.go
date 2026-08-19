package handlers

// backend/posts-service/handlers/comment_handler.go

import (
	"backend/post-service/models"
	"backend/post-service/utils"

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

	// comments[i].UserUsername = utils.GetUsernameByID(comments[i].UserID)
	for i := range comments {
		if u := utils.GetUserByID(comments[i].UserID); u != nil {
			comments[i].UserUsername = u.Username
			comments[i].UserAvatarUrl = u.AvatarUrl // НОВОЕ: аватарки в комментариях
		}
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
	// comment.UserID = 0 // Сбрасываем, чтобы фронтенд его обновил

	// Обогащаем комментарий ПЕРЕД отправкой
	// (Фронтенд не должен ничего обновлять, он должен получить готовые данные)
	//        comment.UserUsername = utils.GetUsernameByID(comment.UserID)
	//    на блок:
	// Обогащаем комментарий ПЕРЕД отправкой
	// (Фронтенд не должен ничего обновлять, он должен получить готовые данные)
	if u := utils.GetUserByID(comment.UserID); u != nil {
		comment.UserUsername = u.Username
		comment.UserAvatarUrl = u.AvatarUrl // НОВОЕ: аватар созданного комментария
	}
	comment.LikesCount = 0
	comment.IsLikedByMe = false

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

// Возвращает корневой комментарий и ВСЕХ его потомков в виде плоского списка
func (h *CommentHandler) GetCommentThread(c *gin.Context) {
	// 1. Получаем ID корневого комментария
	commentID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	// 2. Получаем ID пользователя (для лайков)
	userID_interface, exists := c.Get("userID")
	var userID uint
	if exists {
		// (Ваша безопасная проверка типа)
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
	}
	// 3. Рекурсивный SQL-запрос (Common Table Expression)
	// (Работает в PostgreSQL, MySQL 8+, SQLite 3.8+)
	query := `
	WITH RECURSIVE CommentTree AS (
	-- 1. Выбираем "якорь" (корневой комментарий)
	SELECT * FROM comments WHERE id = ? AND deleted_at IS NULL

	UNION ALL

	-- 2. Рекурсивно выбираем всех детей
	SELECT c.* FROM comments c
	JOIN CommentTree ct ON c.parent_id = ct.id
	WHERE c.deleted_at IS NULL
	)
	-- 3. Возвращаем всю ветку
	SELECT * FROM CommentTree;
	`

	var comments []models.Comment
	if err := h.DB.Raw(query, commentID).Scan(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comment thread"})
		return
	}

	if len(comments) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment thread not found"})
		return
	}

	// 4. Обогащаем ВСЕ комментарии ветки (Usernames, Likes)
	commentIDs := make([]uint, len(comments))
	for i, comment := range comments {
		commentIDs[i] = comment.ID
	}

	// Обогащаем Username + AvatarUrl
	for i := range comments {
		if u := utils.GetUserByID(comments[i].UserID); u != nil {
			comments[i].UserUsername = u.Username
			comments[i].UserAvatarUrl = u.AvatarUrl // НОВОЕ: аватарки в ветке
		}
	}

	// Обогащаем Лайками
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

	// 5. Возвращаем плоский список (фронтенд построит дерево)
	c.JSON(http.StatusOK, comments)
}
