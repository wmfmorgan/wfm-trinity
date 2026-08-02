import { LibraryScreen } from './features/library/LibraryScreen'
import { PlayWorkbench } from './features/play/PlayWorkbench'
import { usePlayStore } from './features/play/playStore'

function App() {
  const screen = usePlayStore((s) => s.screen)

  if (screen === 'library') {
    return <LibraryScreen />
  }

  return <PlayWorkbench />
}

export default App
