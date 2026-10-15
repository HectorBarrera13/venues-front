// Demo accounts last for the current page lifetime; passwords are never persisted.
const partners = new Map()
const usedInvitations = new Set()

export function getRegisteredPartners() { return [...partners.values()] }
export function isInvitationUsed(code) { return usedInvitations.has(code) }

export async function passwordDigest(password, salt) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function saveRegisteredPartner(partner, code) {
  partners.set(partner.username, partner)
  usedInvitations.add(code)
}
