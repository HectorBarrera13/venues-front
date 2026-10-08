const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class EventValidationError extends Error {
  constructor(fields) {
    super('Revisa los datos del evento.')
    this.fields = fields
  }
}

export function parseEventDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day, hour, minute)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
    || date.getHours() !== hour || date.getMinutes() !== minute) return null
  return date
}

export function createEventPayload(form, venues, now = Date.now()) {
  const fields = {}
  const name = form.name.trim()
  const artist = form.artist.trim()
  if (!name) fields.name = 'El nombre es obligatorio.'
  else if (name.length > 255) fields.name = 'El nombre no puede superar 255 caracteres.'
  if (!artist) fields.artist = 'El artista es obligatorio.'
  else if (artist.length > 255) fields.artist = 'El artista no puede superar 255 caracteres.'
  const date = parseEventDate(form.date)
  if (!date) fields.date = 'Introduce una fecha y hora válidas.'
  else if (date.getTime() <= now) fields.date = 'La fecha y hora deben ser futuras.'
  if (!venues.some((venue) => venue.id === form.venue_id)) fields.venue_id = 'Selecciona un recinto del catálogo.'
  else if (!UUID.test(form.venue_id) || form.venue_id === '00000000-0000-0000-0000-000000000000') {
    fields.venue_id = 'Este recinto no tiene un identificador compatible con Events.'
  }
  if (Object.keys(fields).length) throw new EventValidationError(fields)
  return { name, artist, date: date.toISOString(), venue_id: form.venue_id }
}
