package handlers

import (
	"backend/post-service/models"
	"backend/post-service/utils"
	"errors"

	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PostHandler содержит в себе ссылку на базу данных
type PostHandler struct {
	DB *gorm.DB
}

func NewPostHandler(db *gorm.DB) *PostHandler {
	return &PostHandler{DB: db}
}

// Структура для входящих данных при создании поста
type CreatePostInput struct {
	Title    string `json:"title" binding:"required,min=3"`
	Content  string `json:"content" binding:"required,min=5"`
	ImageURL string `json:"image_url,omitempty"`
}

// Создает новый пост в БД
func (h *PostHandler) CreatePost(c *gin.Context) {
	var input CreatePostInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Получаем UserID из контекста, который установил мидлвар
	userID_interface, exists := c.Get("userID")
	if !exists {
		// Этого не должно случиться, если мидлвар отработал
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized access."})
		return
	}

	// Преобразуем тип `interface{}` в `uint`
	userID, ok := userID_interface.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process user ID."})
		return
	}

	post := models.Post{
		UserID:   userID,
		Title:    input.Title,
		Content:  input.Content,
		ImageURL: input.ImageURL,
	}

	if err := h.DB.Create(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create post"})
		return
	}

	c.JSON(http.StatusCreated, post)
}

// Возвращает список всех постов (обогащенный лайками)
func (h *PostHandler) GetPosts(c *gin.Context) {
	// Получаем (опционально) ID пользователя из мидлвар
	// Безопасное получение и приведение типа
	userID_interface, exists := c.Get("userID")
	var userID uint // По умолчанию 0 (гость)

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
	// userID := userID_interface.(uint)
	// Если пользователь не залогинен, userID останется uint(0)

	var posts []models.Post

	// Находим все посты
	if err := h.DB.Order("created_at desc").Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve posts"})
		return
	}

	if len(posts) == 0 {
		c.JSON(http.StatusOK, []models.Post{}) // Возвращаем пустой массив
		return
	}

	// Обогащение постов
	// Собираем ID всех постов
	postsIDs := make([]uint, len(posts))
	for i, post := range posts {
		postsIDs[i] = post.ID
	}

	// Находим ВСЕ лайки для ЭТИХ постов (один запрос к БД)
	var likes []models.Like

	h.DB.Where("post_id IN ?", postsIDs).Find(&likes)

	// Создаем maps ("карты") для быстрого подсчета
	likesCountMap := make(map[uint]int64) // Карта [postID] -> count
	userLikesMap := make(map[uint]bool)   // Карта [postID] -> true (если я лайкнул)

	// Подсчет комментов
	var comments []models.Comment

	h.DB.Where("post_id IN ?", postsIDs).Find(&comments)

	commentCountMap := make(map[uint]int64)

	for _, comment := range comments {
		commentCountMap[comment.PostID]++
	}

	for _, like := range likes {
		// Увеличиваем общий счетчик
		likesCountMap[like.PostID]++

		// Если ID лайка совпадает с ID нашего пользователя
		if userID > 0 && like.UserID == userID {
			userLikesMap[like.PostID] = true
		}
	}

	// Обогащаем наши посты данными из карт
	for i := range posts {
		posts[i].UserUsername = utils.GetUsernameByID(posts[i].UserID)
		posts[i].LikesCount = likesCountMap[posts[i].ID]
		posts[i].IsLikedByMe = userLikesMap[posts[i].ID]
		posts[i].CommentsCount = commentCountMap[posts[i].ID]
	}

	c.JSON(http.StatusOK, posts)
}

func (h *PostHandler) GetPostByID(c *gin.Context) {
	postID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	// 1. Получаем ID пользователя (если он есть) для "IsLikedByMe"
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

	var post models.Post
	if err := h.DB.First(&post, postID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch post"})
		}
		return
	}

	// Читаем параметры пагинации
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit > 50 {
		limit = 50
	}
	offset := (page - 1) * limit

	var comments []models.Comment
	var total int64

	// Считаем всего
	h.DB.Model(&models.Comment{}).Where("post_id = ?", postID).Count(&total)

	// Загружаем с лимитом
	if err := h.DB.Where("post_id = ?", postID).
		Order("created_at asc").
		Limit(limit).
		Offset(offset).
		Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}

	// 2. Обогащаем пост (Вы забыли это сделать)
	post.UserUsername = utils.GetUsernameByID(post.UserID)

	// 3. Считаем лайки (N+1, но для одного поста это нормально)
	var likesCount int64
	h.DB.Model(&models.Like{}).Where("post_id = ?", post.ID).Count(&likesCount)
	post.LikesCount = likesCount

	// 4. Считаем комменты
	var commentsCount int64
	h.DB.Model(&models.Comment{}).Where("post_id = ?", post.ID).Count(&commentsCount)
	post.CommentsCount = commentsCount

	// 5. Проверяем, лайкнул ли ЕГО пользователь
	if userID > 0 {
		var like models.Like
		if h.DB.Where("post_id = ? AND user_id = ?", post.ID, userID).First(&like).Error == nil {
			post.IsLikedByMe = true
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  comments,
		"total": total,
		"page":  page,
	})
}

func (h *PostHandler) LikePost(c *gin.Context) {
	// Получаем ID поста из URL (.../posts/123/like)
	postIDStr := c.Param("id")
	postId_uint, err := strconv.ParseUint(postIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}
	postID := uint(postId_uint)

	// Получаем UserID из мидлвара (уже делали)
	userID_interface, _ := c.Get("userID")
	userID := userID_interface.(uint)

	// Проверка на существование поста
	var post models.Post
	if err := h.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	// Создаем лайк
	like := models.Like{
		UserID: userID,
		PostID: postID,
	}

	// Пытаемся сохранить
	// GORM и `uniqueIndex` автоматически обрабатывают ошибку "уже лайкнуто"
	result := h.DB.Create(&like)
	if result.Error != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Post already liked"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Post liked successfully"})

}

// убирает лайк с поста
func (h *PostHandler) UnlikePost(c *gin.Context) {
	postIDStr := c.Param("id")
	postID_uint, err := strconv.ParseUint(postIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}
	postID := uint(postID_uint)

	// Получаем UserID из мидлвара
	userID_interface, _ := c.Get("userID")
	userID := userID_interface.(uint)

	// Находим и удаляем лайк
	result := h.DB.Where("user_id = ? AND post_id = ?", userID, postID).Delete(&models.Like{})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unlike post"})
		return
	}

	if result.RowsAffected == 0 {
		// если ничего не было удалено (т.е. лайка не было)
		c.JSON(http.StatusNotFound, gin.H{"error": "Like not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post unliked successfully"})
}

// === ADMIN HANDLERS ===

// AdminGetAllPosts - Полный список постов
func (h *PostHandler) AdminGetAllPosts(c *gin.Context) {
	var posts []models.Post
	query := h.DB.Model(&models.Post{})

	// Поиск
	if search := c.Query("q"); search != "" {
		query = query.Where("content ILIKE ? OR title ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// Сортировка
	sortBy := c.DefaultQuery("sort_by", "created_at")
	order := c.DefaultQuery("order", "desc")

	allowedSorts := map[string]bool{"id": true, "user_id": true, "created_at": true, "likes_count": true}
	if !allowedSorts[sortBy] {
		sortBy = "created_at"
	}
	if order != "asc" && order != "desc" {
		order = "desc"
	}

	query = query.Order(sortBy + " " + order)

	// Пагинация
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit > 50 {
		limit = 50
	}
	offset := (page - 1) * limit

	var total int64
	query.Count(&total)

	if err := query.Offset(offset).Limit(limit).Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}

	// Обогащаем именами пользователей (опционально, если нужно в админке)
	for i := range posts {
		posts[i].UserUsername = utils.GetUsernameByID(posts[i].UserID)
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  posts,
		"total": total,
		"page":  page,
	})
}

// AdminDeletePost - Удаление поста
func (h *PostHandler) AdminDeletePost(c *gin.Context) {
	id := c.Param("id")
	if err := h.DB.Delete(&models.Post{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete post"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// --- ЗАГЛУШКИ ДЛЯ НЕРЕАЛИЗОВАННОГО ФУНКЦИОНАЛА ---
// (Чтобы админка могла отправлять запросы и получать пустые списки)

func (h *PostHandler) AdminGetVideos(c *gin.Context) {
	// Пока возвращаем пустой список
	c.JSON(http.StatusOK, gin.H{"data": []interface{}{}, "total": 0})
}

func (h *PostHandler) AdminGetShorts(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []interface{}{}, "total": 0})
}

func (h *PostHandler) AdminGetMusic(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []interface{}{}, "total": 0})
}

func (h *PostHandler) AdminGetStreams(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []interface{}{}, "total": 0})
}
