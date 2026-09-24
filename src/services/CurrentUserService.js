const DEFAULT_USER = Object.freeze({
  userId: 'venue-owner-1',
  name: 'Alex Morgan',
  role: 'venue_owner',
})

class CurrentUserService {
  constructor(initialUser = DEFAULT_USER) {
    this.currentUser = initialUser
    this.listeners = new Set()
  }

  getCurrentUser = () => this.currentUser

  setCurrentUser = (user) => {
    this.currentUser = user
    this.listeners.forEach((listener) => listener())
  }

  subscribe = (listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

const currentUserService = new CurrentUserService()

export { CurrentUserService, DEFAULT_USER }
export default currentUserService
