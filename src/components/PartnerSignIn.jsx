import { useState } from 'react'
import { authenticateMockPartner, getMockSession, getPartnerHome } from '../auth/mockAuth.js'
import { persistToken } from '../auth/token.js'
import { replaceRoute } from '../navigation.js'

export default function PartnerSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      const token = authenticateMockPartner(email, password)
      persistToken(token)
      replaceRoute(getPartnerHome(getMockSession(token)))
    } catch (signInError) {
      setError(signInError.message)
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
            <label htmlFor="sign-in-email">Correo electrónico</label>
            <input id="sign-in-email" name="email" type="email" autoComplete="username"
              required value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} />
          </div>
          <div className="form-field">
            <label htmlFor="sign-in-password">Contraseña</label>
            <input id="sign-in-password" name="password" type="password" autoComplete="current-password"
              required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} />
          </div>
          {error && <p className="sign-in-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit">Iniciar sesión</button>
        </form>
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
