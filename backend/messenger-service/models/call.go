// backend/messenger-service/models/call.go
package models

import (
	"time"

	"gorm.io/gorm"
)

type CallType string

const (
	CallTypeAudio CallType = "audio"
	CallTypeVideo CallType = "video"
)

type CallStatus string

const (
	CallStatusRinging  CallStatus = "ringing"
	CallStatusActive   CallStatus = "active"
	CallStatusEnded    CallStatus = "ended"
	CallStatusMissed   CallStatus = "missed"
	CallStatusDeclined CallStatus = "declined"
)

type Call struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	ConversationID uint       `gorm:"not null;index" json:"conversation_id"`
	InitiatorID    uint       `gorm:"not null" json:"initiator_id"`
	ReceiverID     uint       `gorm:"not null" json:"receiver_id"`
	Type           CallType   `gorm:"not null" json:"type"`
	Status         CallStatus `gorm:"not null;default:'ringing'" json:"status"`

	StartedAt *time.Time `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at"`
	Duration  int        `json:"duration"` // в секундах

	// WebRTC данные
	OfferSDP  string `gorm:"type:text" json:"offer_sdp,omitempty"`
	AnswerSDP string `gorm:"type:text" json:"answer_sdp,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ScreenShare - Демонстрация экрана
type ScreenShare struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	CallID   uint   `gorm:"not null;index" json:"call_id"`
	UserID   uint   `gorm:"not null" json:"user_id"`
	IsActive bool   `gorm:"default:true" json:"is_active"`
	StreamID string `json:"stream_id"`

	StartedAt time.Time      `json:"started_at"`
	EndedAt   *time.Time     `json:"ended_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
