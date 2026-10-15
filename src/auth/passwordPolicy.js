// Ninjava's current contract specifies length only; preserve the entered value.
export const PASSWORD_MIN_LENGTH = 8

export function getPasswordError(password) {
  if (typeof password !== 'string' || !password) return 'La contraseña es obligatoria.'
  if (password.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
  return undefined
}

export function validatePartnerPasswords(password, confirmation) {
  const fields = {}
  const passwordError = getPasswordError(password)
  if (passwordError) fields.password = passwordError
  if (typeof confirmation !== 'string' || !confirmation) fields.confirmPassword = 'Confirma tu contraseña.'
  else if (confirmation !== password) fields.confirmPassword = 'Las contraseñas no coinciden.'
  return fields
}
