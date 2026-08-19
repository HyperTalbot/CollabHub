package utils

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// SuccessResponse структура успешного ответа
type SuccessResponse struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// ErrorResponse структура ответа с ошибкой
type ErrorResponse struct {
	Status  string `json:"status"`
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// RespondWithSuccess отправляет успешный ответ
func RespondWithSuccess(c *gin.Context, statusCode int, message string, data interface{}) {
	c.JSON(statusCode, SuccessResponse{
		Status:  "success",
		Message: message,
		Data:    data,
	})
}

// RespondWithError отправляет ответ с ошибкой
func RespondWithError(c *gin.Context, statusCode int, message string, details string) {
	c.JSON(statusCode, ErrorResponse{
		Status:  "error",
		Error:   message,
		Details: details,
	})
}

// RespondNotFound отправляет ответ 404
func RespondNotFound(c *gin.Context, resource string) {
	RespondWithError(c, http.StatusNotFound, resource+" not found", "")
}

// RespondUnauthorized отправляет ответ 401
func RespondUnauthorized(c *gin.Context, message string) {
	RespondWithError(c, http.StatusUnauthorized, message, "")
}

// RespondForbidden отправляет ответ 403
func RespondForbidden(c *gin.Context, message string) {
	RespondWithError(c, http.StatusForbidden, message, "")
}

// RespondBadRequest отправляет ответ 400
func RespondBadRequest(c *gin.Context, message string, details string) {
	RespondWithError(c, http.StatusBadRequest, message, details)
}

// RespondInternalError отправляет ответ 500
func RespondInternalError(c *gin.Context, message string, err error) {
	details := ""
	if err != nil {
		details = err.Error()
	}
	RespondWithError(c, http.StatusInternalServerError, message, details)
}
