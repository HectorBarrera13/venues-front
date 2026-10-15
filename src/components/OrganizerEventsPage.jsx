import OrganizerEventList from './OrganizerEventList.jsx'
import useOrganizerEvents from '../hooks/useOrganizerEvents.js'

export default function OrganizerEventsPage() {
  const { changePage, changePerPage, refresh, refreshVenues, ...view } = useOrganizerEvents()
  return <OrganizerEventList {...view} onPageChange={changePage} onPerPageChange={changePerPage} onRetry={refresh} onVenueRetry={refreshVenues} />
}
