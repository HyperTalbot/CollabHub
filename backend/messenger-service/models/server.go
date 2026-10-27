package models

import (
	"time"

	"gorm.io/gorm"
)

type Server struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Name        string `gorm:"not null" json:"name"`
	Description string `json:"description"` // Опционально
	AvatarURL   string `json:"avatar_url"`

	OwnerID uint `gorm:"not null" json:"owner_id"`
	Owner   User `gorm:"foreingKey:OwnerID" json:"-"`

	// Хештеги можно хранить как массив сток (PostgreSQL поддерживает)
	// Или как простую строку через запятую для простоты. Выбрали строку.
	Tags string // Пример: "gaming,dev,friends"

	// Связи
	Channels []Channel `gorm:"foreignKey:ServerID" json:"channels,omitempty"`      // Каналы внутри сервера
	Members  []User    `gorm:"many2many:server_members;" json:"members,omitempty"` // Участники сервера

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// ServerInvite - Инвайт-ссылки для серверов
type ServerInvite struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	ServerID  uint   `gorm:"not null;index" json:"server_id"`
	Code      string `gorm:"uniqueIndex;not null" json:"code"` // Уникальный код
	CreatedBy uint   `gorm:"not null" json:"created_by"`

	MaxUses   int        `gorm:"default:0" json:"max_uses"` // 0 = безлимит
	UsesCount int        `gorm:"default:0" json:"uses_count"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ServerInvitation — приглашение пользователя на сервер
type ServerInvitation struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	ServerID  uint   `gorm:"not null;index" json:"server_id"`
	InviterID uint   `gorm:"not null" json:"inviter_id"`
	InviteeID uint   `gorm:"not null;index" json:"invitee_id"`
	Status    string `gorm:"default:pending" json:"status"` // pending | accepted | rejected

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ServerRole - Роли на сервере
type ServerRole struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	ServerID uint   `gorm:"not null;index" json:"server_id"`
	Name     string `gorm:"not null" json:"name"`
	Color    string `json:"color"`                     // HEX цвет
	Position int    `gorm:"default:0" json:"position"` // Порядок ролей

	// Права
	CanManageServer    bool `gorm:"default:false" json:"can_manage_server"`
	CanManageChannels  bool `gorm:"default:false" json:"can_manage_channels"`
	CanManageRoles     bool `gorm:"default:false" json:"can_manage_roles"`
	CanKickMembers     bool `gorm:"default:false" json:"can_kick_members"`
	CanBanMembers      bool `gorm:"default:false" json:"can_ban_members"`
	CanManageMessages  bool `gorm:"default:false" json:"can_manage_messages"`
	CanMentionEveryone bool `gorm:"default:false" json:"can_mention_everyone"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ServerMemberRole - Связь пользователь-роль на сервере
type ServerMemberRole struct {
	ServerID uint `gorm:"primaryKey" json:"server_id"`
	UserID   uint `gorm:"primaryKey" json:"user_id"`
	RoleID   uint `gorm:"primaryKey" json:"role_id"`
}
