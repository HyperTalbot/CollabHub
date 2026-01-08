const API_BASE_URL = process.env.NEXT_PUBLIC_MUSIC_API_URL || 'http://localhost:8085/api/music';

export interface Track {
  id: number;
  title: string;
  artist: string;
  album?: string;
  cover_url: string;
  audio_url: string;
  duration: number;
  genre?: string;
  play_count?: number;
  likes_count?: number;
}

export interface Playlist {
  id: number;
  name: string;
  description: string;
  cover_url: string;
  user_id: number;
  is_public: boolean;
  tracks?: Track[];
}

export interface Comment {
  id: number;
  track_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

class MusicService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Треки
  async getGenres(): Promise<string[]> {
    return this.request('/genres');
  }

  async getQuickPicks(): Promise<Track[]> {
    return this.request('/quick-picks');
  }

  async getRecommendedTracks(): Promise<Track[]> {
    return this.request('/recommended');
  }

  async getTrackById(id: number): Promise<Track> {
    return this.request(`/tracks/${id}`);
  }

  async getSimilarTracks(id: number): Promise<Track[]> {
    return this.request(`/tracks/${id}/similar`);
  }

  async searchTracks(query: string): Promise<Track[]> {
    return this.request(`/search?q=${encodeURIComponent(query)}`);
  }

  async incrementPlayCount(trackId: number): Promise<void> {
    await this.request(`/tracks/${trackId}/play, { method: 'POST' }`);
  }

  async likeTrack(trackId: number): Promise<void> {
    await this.request(`/tracks/${trackId}/like, { method: 'POST' }`);
  }

  async unlikeTrack(trackId: number): Promise<void> {
    await this.request(`/tracks/${trackId}/like, { method: 'DELETE' }`);
  }

  // Плейлисты
  async getRecommendedPlaylists(): Promise<Playlist[]> {
    return this.request('/playlists/recommended');
  }

  async getPlaylistById(id: number): Promise<Playlist> {
    return this.request(`/playlists/${id}`);
  }

  async getUserPlaylists(): Promise<Playlist[]> {
    return this.request('/playlists');
  }

  async createPlaylist(data: {
    name: string;
    description?: string;
    cover_url?: string;
    is_public?: boolean;
  }): Promise<Playlist> {
    return this.request('/playlists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePlaylist(
    id: number,
    data: {
      name?: string;
      description?: string;
      cover_url?: string;
      is_public?: boolean;
    }
  ): Promise<Playlist> {
    return this.request(`/playlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePlaylist(id: number): Promise<void> {
    await this.request(`/playlists/${id}`, { method: 'DELETE' });
  }

  async addTrackToPlaylist(playlistId: number, trackId: number): Promise<void> {
    await this.request(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId }),
    });
  }

  async removeTrackFromPlaylist(playlistId: number, trackId: number): Promise<void> {
    await this.request(`/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
    });
  }

  // Комментарии
  async getComments(trackId: number): Promise<Comment[]> {
    return this.request(`/tracks/${trackId}/comments`);
  }

  async createComment(trackId: number, content: string): Promise<Comment> {
    return this.request(`/tracks/${trackId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteComment(commentId: number): Promise<void> {
    await this.request(`/comments/${commentId}`, { method: 'DELETE' });
  }
}

export const musicService = new MusicService();