import { create } from 'zustand'
import type { UserDto } from '@repo/api-client'

interface AuthState {
  user: UserDto | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: UserDto) => void
  logout: () => void
  setUser: (user: UserDto) => void
}

const STORAGE_TOKEN_KEY = 'ep_auth_token'
const STORAGE_USER_KEY = 'ep_auth_user'

export const useAuthStore = create<AuthState>((set) => {
  // Initialize from localStorage if available
  let savedToken: string | null = null
  let savedUser: UserDto | null = null

  try {
    savedToken = localStorage.getItem(STORAGE_TOKEN_KEY)
    const rawUser = localStorage.getItem(STORAGE_USER_KEY)
    if (rawUser) {
      savedUser = JSON.parse(rawUser)
    }
  } catch (e) {
    console.error('Failed to load auth from localStorage:', e)
  }

  return {
    user: savedUser,
    token: savedToken,
    isAuthenticated: !!savedToken,
    login: (token: string, user: UserDto) => {
      try {
        localStorage.setItem(STORAGE_TOKEN_KEY, token)
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
      } catch (e) {
        console.error('Failed to save auth state:', e)
      }
      set({ token, user, isAuthenticated: true })
    },
    logout: () => {
      try {
        localStorage.removeItem(STORAGE_TOKEN_KEY)
        localStorage.removeItem(STORAGE_USER_KEY)
      } catch (e) {
        console.error('Failed to clear auth state:', e)
      }
      set({ token: null, user: null, isAuthenticated: false })
    },
    setUser: (user: UserDto) => {
      try {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
      } catch (e) {
        console.error('Failed to update user state:', e)
      }
      set({ user })
    },
  }
})
