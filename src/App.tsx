import { LibraryScreen } from './features/library/LibraryScreen'
import { usePlayStore } from './features/play/playStore'

function App() {
  const screen = usePlayStore((s) => s.screen)

  if (screen === 'library') {
    return <LibraryScreen />
  }

  // PlayWorkbench lands in a later task; keep a minimal shell so navigation works.
  return (
    <div data-testid="play-placeholder">
      <p>Play workbench (coming soon)</p>
      <button type="button" onClick={() => usePlayStore.getState().returnToLibrary()}>
        Library
      </button>
    </div>
  )
}

export default App
