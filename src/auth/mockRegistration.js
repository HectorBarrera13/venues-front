import { MOCK_ACCOUNTS } from './mockAuth.js'
import { PartnerRegistrationError } from './partnerRegistration.js'
import { getPasswordError } from './passwordPolicy.js'
import { getRegisteredPartners, isInvitationUsed, passwordDigest, saveRegisteredPartner } from './mockPartnerStore.js'

// Frontend-only invitations map onto the two partners known to Events.
export const DEMO_INVITATIONS = Object.freeze([
  Object.freeze({ code: 'K7PX-3MZQ-9HTA', partnerId: MOCK_ACCOUNTS[0].userId }),
  Object.freeze({ code: 'V7PX-3MZQ-9HTA', partnerId: MOCK_ACCOUNTS[1].userId }),
])

export async function registerMockPartner({ username, password, invitationCode }) {
  const normalizedUsername = username.trim().toLowerCase()
  if (!normalizedUsername) throw new PartnerRegistrationError('El usuario es obligatorio.', 400, { username: 'El usuario es obligatorio.' })
  const passwordError = getPasswordError(password)
  if (passwordError) throw new PartnerRegistrationError(passwordError, 400, { password: passwordError })
  const usernameExists = () => MOCK_ACCOUNTS.some((item) => item.email === normalizedUsername)
    || getRegisteredPartners().some((item) => item.username === normalizedUsername)
  if (usernameExists()) throw new PartnerRegistrationError('Este usuario ya está registrado.', 409, { username: 'Elige otro usuario.' })
  const invitation = DEMO_INVITATIONS.find((item) => item.code === invitationCode)
  const account = MOCK_ACCOUNTS.find((item) => item.userId === invitation?.partnerId)
  if (!account || isInvitationUsed(invitationCode)) {
    throw new PartnerRegistrationError('El código de invitación no existe o ya fue usado.', 400, { invitationCode: 'Utiliza una invitación válida y sin usar.' })
  }
  const salt = crypto.randomUUID()
  const digest = await passwordDigest(password, salt)
  // Recheck after hashing so concurrent submissions cannot consume a code twice.
  if (usernameExists()) throw new PartnerRegistrationError('Este usuario ya está registrado.', 409, { username: 'Elige otro usuario.' })
  if (isInvitationUsed(invitationCode)) throw new PartnerRegistrationError('La invitación ya fue usada.')
  saveRegisteredPartner({ userId: account.userId, username: normalizedUsername, salt, digest }, invitationCode)
  return { id: account.userId, username: normalizedUsername, role: account.role }
}
