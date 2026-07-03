export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  const [
    { installHttpRequestTracking },
    { initializeGracefulShutdown },
    { initializeCriticalResourceShutdownHandlers },
  ] = await Promise.all([
    import('@/lib/runtime/http-request-tracking'),
    import('@/lib/utils/graceful-shutdown'),
    import('@/lib/runtime/critical-resource-cleanup'),
  ])

  installHttpRequestTracking()
  initializeGracefulShutdown()
  initializeCriticalResourceShutdownHandlers()
}
