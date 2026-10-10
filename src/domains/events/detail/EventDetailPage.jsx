import useEventDetail from './useEventDetail.js'
import EventDetailView from './EventDetailView.jsx'

export default function EventDetailPage({ eventId }) {
  const detail = useEventDetail(eventId)

  return (
    <EventDetailView
      event={detail.event}
      venue={detail.venue}
      loading={detail.loading}
      error={detail.error}
      status={detail.status}
      venuesLoading={detail.venuesLoading}
      venueError={detail.venueError}
      canEdit={detail.canEdit}
      onRetry={detail.retry}
      onRetryVenue={detail.retryVenue}
    />
  )
}
