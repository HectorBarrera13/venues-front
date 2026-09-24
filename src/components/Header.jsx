import useCurrentUser from '../hooks/useCurrentUser.js'
import VenueOwnerOnly from './VenueOwnerOnly.jsx'

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function Header({ isRegisterRoute = typeof window !== 'undefined' && window.location.pathname === '/venues/register' }) {
  const { currentUser } = useCurrentUser()

  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="/" aria-label="Venues, inicio">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span className="brand-name">Venues</span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <a href="/" aria-current={!isRegisterRoute ? 'page' : undefined}>Mis recintos</a>
        </nav>
        {currentUser && (
          <div className="user-summary" aria-label={`Sesión de ${currentUser.name}`}>
            <span className="user-avatar" aria-hidden="true">{getInitials(currentUser.name)}</span>
            <span className="user-copy">
              <span className="user-name">{currentUser.name}</span>
              <span className="user-role">
                {currentUser.role === 'venue_owner' ? 'Propietario' : 'Organizador'}
              </span>
            </span>
          </div>
        )}
        {!isRegisterRoute && (
          <VenueOwnerOnly>
            <a className="primary-button primary-button--light" href="/venues/register">
              <svg className="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              Registrar recinto
            </a>
          </VenueOwnerOnly>
        )}
      </div>
    </header>
  )
}

export default Header
