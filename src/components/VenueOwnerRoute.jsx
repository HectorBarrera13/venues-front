import { useEffect } from 'react'
import useCurrentUser from '../hooks/useCurrentUser.js'
import { SIGN_IN_PATH } from '../auth/constants.js'
import { goToSignIn, isVenueOwner } from '../auth/session.js'

function AccessPanel({ title, description, children }) {
  return (
    <section className="state-panel state-panel--error" role="alert">
      <div className="state-panel-inner">
        <h3>{title}</h3>
        <p>{description}</p>
        {children}
      </div>
    </section>
  )
}

/**
 * Guards the "Registrar venue" screen.
 *
 * This is UX only — the backend is what actually rejects a request from
 * someone who isn't a venue owner. Here it just avoids showing a form that
 * could never succeed:
 * - no session (no token, not a JWT, or past its exp): the route isn't
 *   available, so we send them to sign-in when that route exists and
 *   otherwise say so;
 * - ORGANIZER: not their screen, so it isn't rendered;
 * - VENUE_OWNER: the form.
 */
function VenueOwnerRoute({ children }) {
  const { currentUser } = useCurrentUser()
  const hasSession = Boolean(currentUser)

  useEffect(() => {
    if (!hasSession) goToSignIn()
  }, [hasSession])

  if (!hasSession) {
    return (
      <AccessPanel
        title="Necesitas iniciar sesión"
        description="Tu sesión expiró o no es válida. Inicia sesión de nuevo para registrar un recinto."
      >
        {SIGN_IN_PATH && (
          <a className="primary-button" href={SIGN_IN_PATH}>
            Iniciar sesión
          </a>
        )}
      </AccessPanel>
    )
  }

  if (!isVenueOwner(currentUser)) {
    return (
      <AccessPanel
        title="No tienes acceso a esta sección"
        description="Solo los propietarios de recintos pueden registrar un recinto."
      />
    )
  }

  return children
}

export default VenueOwnerRoute
