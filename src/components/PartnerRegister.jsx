import { useEffect, useRef, useState } from 'react'
import { createPartnerRegistrationPayload } from '../auth/partnerRegistration.js'
import { registerMockPartner } from '../auth/mockRegistration.js'
import { replaceRoute } from '../navigation.js'
import { getPasswordError, PASSWORD_MIN_LENGTH, validatePartnerPasswords } from '../auth/passwordPolicy.js'

export default function PartnerRegister() {
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '', invitationCode: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [registered, setRegistered] = useState(null)
  const [touched, setTouched] = useState({})
  const busy = useRef(false)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const passwordErrors = validatePartnerPasswords(form.password, form.confirmPassword)
  const fieldError = (field) => ['password', 'confirmPassword'].includes(field) && touched[field]
    ? passwordErrors[field] : errors[field]

  function changeField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setTouched((previous) => ({ ...previous, [field]: true }))
    setErrors((previous) => ({ ...previous, [field]: '' }))
    setError('')
  }

  const goToLogin = (event) => { event.preventDefault(); replaceRoute('/login') }
  async function submit(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    setErrors({})
    setTouched({ password: true, confirmPassword: true })
    try {
      const payload = createPartnerRegistrationPayload(form)
      const result = await registerMockPartner(payload)
      if (active.current) {
        setRegistered(result)
        setForm({ username: '', password: '', confirmPassword: '', invitationCode: '' })
      }
    } catch (failure) {
      if (active.current) {
        setError(failure.message)
        setErrors(failure.fields || {})
        const firstField = ['username', 'password', 'confirmPassword', 'invitationCode'].find((field) => failure.fields?.[field])
        if (firstField) formElement.elements.namedItem(firstField)?.focus()
      }
    } finally {
      busy.current = false
      if (active.current) setPending(false)
    }
  }

  return (
    <main className="sign-in-page">
      <section className="sign-in-card" aria-labelledby="partner-register-title">
        <p className="eyebrow">Ticket D-Saster · Backstage</p>
        <h1 id="partner-register-title">Regístrate con invitación</h1>
        {registered ? (
          <div role="status">
            <p>Registro de demostración completado para <strong>{registered.username}</strong>.</p>
            <p>Ahora puedes iniciar sesión. Esta cuenta demo estará disponible hasta recargar la página.</p>
            <a className="primary-button" href="/login" onClick={goToLogin}>Iniciar sesión</a>
          </div>
        ) : (
          <>
            <p>El código de invitación determina el tipo de cuenta.</p>
            <form className="sign-in-form" onSubmit={submit} noValidate>
              {Object.entries({ username: 'Usuario', password: 'Contraseña', confirmPassword: 'Confirmar contraseña', invitationCode: 'Código de invitación' }).map(([field, label]) => (
                <div className="form-field" key={field}>
                  <label htmlFor={`register-${field}`}>{label}</label>
                  <input id={`register-${field}`} name={field} required disabled={pending} value={form[field]}
                    type={field.includes('assword') ? 'password' : 'text'}
                    autoComplete={field === 'username' ? 'username' : field.includes('assword') ? 'new-password' : 'off'}
                    minLength={field === 'password' ? PASSWORD_MIN_LENGTH : undefined}
                    aria-invalid={Boolean(fieldError(field))}
                    aria-describedby={[field === 'password' && 'password-minimum', field === 'confirmPassword' && touched.confirmPassword && !passwordErrors.confirmPassword && 'password-match', fieldError(field) && `error-${field}`].filter(Boolean).join(' ') || undefined}
                    onBlur={() => setTouched((previous) => ({ ...previous, [field]: true }))}
                    onChange={(event) => changeField(field, event.target.value)} />
                  {field === 'password' && <p id="password-minimum" aria-live="polite">
                    {touched.password && !getPasswordError(form.password) ? 'Mínimo cumplido: ' : ''}Al menos {PASSWORD_MIN_LENGTH} caracteres.
                  </p>}
                  {field === 'confirmPassword' && touched.confirmPassword && !passwordErrors.confirmPassword && <p id="password-match" aria-live="polite">Las contraseñas coinciden.</p>}
                  {fieldError(field) && <p id={`error-${field}`} className="form-error" aria-live="polite">{fieldError(field)}</p>}
                </div>
              ))}
              {error && <p className="sign-in-error" role="alert">{error}</p>}
              <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Registrando…' : 'Registrarme'}</button>
            </form>
            <aside className="demo-accounts">
              <strong>Invitaciones de demostración</strong>
              <p>Organizador: <code>K7PX-3MZQ-9HTA</code></p>
              <p>Propietario: <code>V7PX-3MZQ-9HTA</code></p>
              <p>Cada código se puede usar una vez hasta recargar la página.</p>
            </aside>
            <a className="back-link" href="/login" onClick={goToLogin}>Ya tengo cuenta · Iniciar sesión</a>
          </>
        )}
      </section>
    </main>
  )
}
