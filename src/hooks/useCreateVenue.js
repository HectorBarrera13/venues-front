import { useCallback, useRef, useState } from 'react'
import venueApiClient from '../services/VenueApiClient.js'

/**
 * useCreateVenue
 *
 * Wraps VenueApiClient.createVenue and exposes the loading/error/success
 * state the "Register Venue" form needs to render itself, plus the `venue`
 * the API returned so the success confirmation can show it. `error` is never
 * just a message string — `error.status` (400 vs 401 vs 403) and
 * `error.field` (which input a 400 is about) are what the form needs to tell
 * a validation error from a session error from a permission error.
 *
 * @returns {{
 *   createVenue: (data: { name: string, description: string, location: string }) => Promise<object | undefined>,
 *   reset: () => void,
 *   isLoading: boolean,
 *   isSuccess: boolean,
 *   isError: boolean,
 *   error: (Error & { status?: number, field?: string | null }) | null,
 *   venue: object | null,
 * }}
 */
function useCreateVenue() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [venue, setVenue] = useState(null)
  const requestIdRef = useRef(0)

  const reset = useCallback(() => {
    requestIdRef.current += 1 // invalidate any in-flight request
    setIsLoading(false)
    setError(null)
    setIsSuccess(false)
    setVenue(null)
  }, [])

  const createVenue = useCallback(
    async (data) => {
      const requestId = (requestIdRef.current += 1)
      setIsLoading(true)
      setError(null)
      setIsSuccess(false)

      try {
        const createdVenue = await venueApiClient.createVenue(data)
        if (requestIdRef.current !== requestId) return undefined // superseded by a newer call or a reset()

        setVenue(createdVenue)
        setIsSuccess(true)
        return createdVenue
      } catch (requestError) {
        if (requestIdRef.current !== requestId) return undefined
        setError(requestError)
        setIsSuccess(false)
        return undefined
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false)
      }
    },
    [],
  )

  return { createVenue, reset, isLoading, isSuccess, isError: Boolean(error), error, venue }
}

export { useCreateVenue }
export default useCreateVenue
