package models

import "time"

// Poll - Опросы
type Poll struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	MessageID      uint   `gorm:"not null;uniqueIndex" json:"message_id"`
	Question       string `gorm:"not null" json:"question"`
	CreatedBy      uint   `gorm:"not null" json:"created_by"`
	MultipleChoice bool   `gorm:"default:false" json:"multiple_choice"`

	Options   []PollOption `gorm:"foreignKey:PollID" json:"options"`
	ExpiresAt *time.Time   `json:"expires_at,omitempty"`
	CreatedAt time.Time    `json:"created_at"`
}

// PollOption - Варианты ответа в опросе
type PollOption struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	PollID uint   `gorm:"not null;index" json:"poll_id"`
	Text   string `gorm:"not null" json:"text"`

	Votes []PollVote `gorm:"foreignKey:OptionID" json:"votes,omitempty"`
}

// PollVote - Голоса в опросе
type PollVote struct {
	ID       uint `gorm:"primaryKey" json:"id"`
	PollID   uint `gorm:"not null;index" json:"poll_id"`
	OptionID uint `gorm:"not null;index" json:"option_id"`
	UserID   uint `gorm:"not null;index" json:"user_id"`

	CreatedAt time.Time `json:"created_at"`
}
