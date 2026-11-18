// Editor tools (VEN-503). Everything that mutates the document goes through
// one active tool; seats and zones stay locked until the stage is drawn.

export const TOOLS = Object.freeze({
  SELECT: 'select',
  STAGE: 'stage',
  SEAT: 'seat',
  BLOCK: 'block',
  ZONE: 'zone',
})

/** The stage is the required first element: seat/zone tools unlock only after it exists. */
export function toolGate(tool, hasStage) {
  if (tool === TOOLS.SELECT || tool === TOOLS.STAGE) return { enabled: true, reason: null }
  return hasStage
    ? { enabled: true, reason: null }
    : { enabled: false, reason: 'Dibuja el escenario antes de colocar asientos o zonas.' }
}
