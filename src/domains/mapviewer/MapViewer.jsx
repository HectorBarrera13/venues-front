import MapCanvas from '../mapeditor/MapCanvas.jsx'
import { TOOLS } from '../mapeditor/tools.js'

/**
 * Pure read-only renderer of a saved MapVersion (VEN-601).
 * Accepts { stage, zones, seats } — the shape returned by GET /venues/:id/map.
 * No toolbar, no editing tools, no mutable state.
 */
function MapViewer({ stage, zones = [], seats = [] }) {
  return (
    <div className="map-viewer" style={{ width: '100%', height: '100%', minHeight: 400 }}>
      <MapCanvas
        stage={stage}
        zones={zones}
        seats={seats}
        tool={TOOLS.SELECT}
        readOnly={true}
      />
    </div>
  )
}

export default MapViewer
