import EventRegisterForm from './EventRegisterForm.jsx'
import useEventRegistration from '../hooks/useEventRegistration.js'

export default function EventRegisterPage() {
  const { catalogue, submission, submit, reloadCatalogue } = useEventRegistration()
  return <EventRegisterForm catalogue={catalogue} submission={submission} onSubmit={submit} onReload={reloadCatalogue} />
}
