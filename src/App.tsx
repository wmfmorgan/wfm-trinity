import { ErrorBanner } from './app/ErrorBanner'
import { LibraryScreen } from './features/library/LibraryScreen'
import { PlayWorkbench } from './features/play/PlayWorkbench'
import { useLibraryStore } from './features/library/libraryStore'
import { usePlayStore } from './features/play/playStore'

function App() {
  const screen = usePlayStore((s) => s.screen)
  const libraryError = useLibraryStore((s) => s.error)
  const playError = usePlayStore((s) => s.error)
  const clearLibraryError = useLibraryStore((s) => s.clearError)
  const clearPlayError = usePlayStore((s) => s.clearError)
  const returnToLibrary = usePlayStore((s) => s.returnToLibrary)

  // Prefer library error when both are set (import/open path surfaces first).
  const errorMessage = libraryError ?? playError
  const showReturnToLibrary =
    screen === 'play' && playError != null && playError !== '' && !libraryError

  function dismissError() {
    clearLibraryError()
    clearPlayError()
  }

  return (
    <>
      {screen === 'library' ? <LibraryScreen /> : <PlayWorkbench />}
      {errorMessage ? (
        <ErrorBanner
          message={errorMessage}
          onDismiss={dismissError}
          secondaryAction={
            showReturnToLibrary
              ? {
                  label: 'Return to library',
                  onClick: () => returnToLibrary(),
                }
              : undefined
          }
        />
      ) : null}
    </>
  )
}

export default App
