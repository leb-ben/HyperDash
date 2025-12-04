import { Play, Square } from 'lucide-react'

interface Props {
  isRunning: boolean
  onStart: () => void
  onStop: () => void
}

export function BotControl({ isRunning, onStart, onStop }: Props) {
  return (
    <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
      <button 
        onClick={onStart} 
        className={`p-2 rounded ${isRunning ? 'bg-green-500/30 text-green-400' : 'hover:bg-slate-600 text-slate-400'}`}
        disabled={isRunning}
      >
        <Play className="w-4 h-4" />
      </button>
      <button 
        onClick={onStop} 
        className={`p-2 rounded ${!isRunning ? 'text-slate-600' : 'hover:bg-slate-600 text-slate-400'}`}
        disabled={!isRunning}
      >
        <Square className="w-4 h-4" />
      </button>
    </div>
  )
}

export default BotControl
