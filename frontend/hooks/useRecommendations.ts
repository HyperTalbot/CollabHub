// frontend/hooks/useRecommendations.ts
"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';

interface Recommendation {
  content_type: 'post' | 'video' | 'short' | 'stream' | 'music';
  content_id: number;
  score: number;
  reason: 'trending' | 'similar_users' | 'your_interests';
}

interface UseRecommendationsProps {
  type?: 'all' | 'post' | 'video' | 'short' | 'stream' | 'music';
  limit?: number;
}

export function useRecommendations({ 
  type = 'all', 
  limit = 20 
}: UseRecommendationsProps = {}) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
  }, [type, limit]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/v1/recommendations/feed', {
        params: { type, limit }
      });

      setRecommendations(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load recommendations');
      console.error('Recommendations error:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    recommendations,
    loading,
    error,
    refetch: fetchRecommendations,
  };
}