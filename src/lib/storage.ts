import { v4 as uuidv4 } from 'uuid';

const DEVICE_TOKEN_KEY = 'khaleej_device_token';

export function getDeviceToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) {
    token = uuidv4();
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

export function savePlayerProfile(profile: any) {
  localStorage.setItem('khaleej_player_profile', JSON.stringify(profile));
}

export function getSavedPlayerProfile(): any | null {
  const data = localStorage.getItem('khaleej_player_profile');
  return data ? JSON.parse(data) : null;
}
