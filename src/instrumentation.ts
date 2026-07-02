export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  const [
    { installHttpRequestTracking },
    { initializeGracefulShutdown },
    {
      initializeCriticalResourceShutdownHandlers,
      registerCacheShutdownCleanup,
    },
    { startExportProgressSweep },
  ] = await Promise.all([
    import('@/lib/runtime/http-request-tracking'),
    import('@/lib/utils/graceful-shutdown'),
    import('@/lib/runtime/critical-resource-cleanup'),
    import('@/lib/utils/export-progress-registry'),
  ])

  installHttpRequestTracking()
  initializeGracefulShutdown()
  initializeCriticalResourceShutdownHandlers()

  const stopExportProgressSweep = startExportProgressSweep()
  registerCacheShutdownCleanup('export-progress-sweep', stopExportProgressSweep)
}
