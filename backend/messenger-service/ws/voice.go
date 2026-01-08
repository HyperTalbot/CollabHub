package ws

import (
	"sync"
)

// VoiceState - хранит в каких голосовых каналах кто "в голосе"
type VoiceState struct {
	// channel_id -> set of user_ids
	InVoice map[uint]map[uint]bool
	mu      sync.RWMutex
}

func NewVoiceState() *VoiceState {
	return &VoiceState{
		InVoice: make(map[uint]map[uint]bool),
	}
}

func (vs *VoiceState) Join(channelID, userID uint) {
	vs.mu.Lock()
	defer vs.mu.Unlock()
	if vs.InVoice[channelID] == nil {
		vs.InVoice[channelID] = make(map[uint]bool)
	}
	vs.InVoice[channelID][userID] = true
}

func (vs *VoiceState) Leave(channelID, userID uint) {
	vs.mu.Lock()
	defer vs.mu.Unlock()
	if vs.InVoice[channelID] != nil {
		delete(vs.InVoice[channelID], userID)
		if len(vs.InVoice[channelID]) == 0 {
			delete(vs.InVoice, channelID)
		}
	}
}

func (vs *VoiceState) GetUsers(channelID uint) []uint {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	out := []uint{}
	for uid := range vs.InVoice[channelID] {
		out = append(out, uid)
	}
	return out
}

