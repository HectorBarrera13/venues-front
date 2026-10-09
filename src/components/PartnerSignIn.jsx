import { useRef, useState } from 'react'
import { signInMockPartner, getPartnerHome } from '../auth/mockAuth.js'
import { getConfiguredVenueToken, persistToken } from '../auth/token.js'
import { selectOwnerLoginToken } from '../auth/venueCredential.js'
import { getSession } from '../auth/session.js'
import { replaceRoute } from '../navigation.js'

export default function PartnerSignIn() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      const mockToken = await signInMockPartner(username, password)
      const token = selectOwnerLoginToken(mockToken, getConfiguredVenueToken())
      persistToken(token)
      replaceRoute(getPartnerHome(getSession()))
    } catch (signInError) {
      setError(signInError.message)
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return (
    <main className="sign-in-page">
      <section className="sign-in-card" aria-labelledby="sign-in-title">
        <span className="brand-mark" aria-hidden="true">B</span>
        <p className="eyebrow">Ticket D-Saster · Backstage</p>
        <h1 id="sign-in-title">Inicia sesión</h1>
        <p>Accede a tu espacio para administrar recintos o eventos.</p>
        <form onSubmit={handleSubmit} className="sign-in-form">
          <div className="form-field">
            <label htmlFor="sign-in-username">Usuario</label>
            <input id="sign-in-username" name="username" type="text" autoComplete="username"
              required value={username} disabled={pending} onChange={(event) => { setUsername(event.target.value); setError('') }} />
          </div>
          <div className="form-field">
            <label htmlFor="sign-in-password">Contraseña</label>
            <input id="sign-in-password" name="password" type="password" autoComplete="current-password"
              required value={password} disabled={pending} onChange={(event) => { setPassword(event.target.value); setError('') }} />
          </div>
          {error && <p className="sign-in-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Iniciando sesión…' : 'Iniciar sesión'}</button>
        </form>
        <a className="back-link" href="/register" onClick={(event) => { event.preventDefault(); replaceRoute('/register') }}>Registrarme con invitación</a>
        <aside className="demo-accounts" aria-label="Cuentas de demostración">
          <strong>Acceso de demostración</strong>
          <p>Organizador: <code>organizer@example.com</code></p>
          <p>Propietario: <code>owner@example.com</code></p>
          <p>Contraseña: <code>Backstage123!</code></p>
        </aside>
      </section>
    </main>
  )
}
