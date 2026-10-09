export class PartnerRegistrationError extends Error {
  constructor(message, status = 400, fields = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

// The registration contract contains no role, email, or confirmation field.
export function createPartnerRegistrationPayload(form) {
  const fields = {}
  const username = form.username.trim()
  const invitationCode = form.invitationCode.trim().toUpperCase()
  if (!username) fields.username = 'El usuario es obligatorio.'
  if (!form.password) fields.password = 'La contraseña es obligatoria.'
  else if (form.password.length < 8) fields.password = 'La contraseña debe tener al menos 8 caracteres.'
  if (form.confirmPassword !== form.password) fields.confirmPassword = 'Las contraseñas no coinciden.'
  if (!invitationCode) fields.invitationCode = 'El código de invitación es obligatorio.'
  if (Object.keys(fields).length) throw new PartnerRegistrationError('Revisa los datos del registro.', 400, fields)
  return { username, password: form.password, invitationCode }
}
