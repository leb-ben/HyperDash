import { Clock } from 'lucide-react'

interface ActivityEvent {
  id: string
  timestamp: number
  type: string
  source: string
  message: string
}

interface Props {
  activities: ActivityEvent[]
}

export function ActivityFeed({ activities }: Props) {
  const getTimeSince = (ts: number) => {
    const sec = Math.floor((Date.now() - ts) / 1000)
    if (sec < 60) return `${sec}s ago`
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
    return `${Math.floor(sec / 3600)}h ago`
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'ai_decision': return 'text-purple-400'
      case 'signal': return 'text-blue-400'
      case 'trade': return 'text-green-400'
      case 'error': return 'text-red-400'
      case 'warning': return 'text-yellow-400'
      default: return 'text-slate-400'
    }
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold">Activity Feed</span>
        <span className="text-xs text-slate-500 ml-auto">Real-time updates</span>
      </div>
      <div className="space-y-2 max-h-64 overflow-auto">
        {activities.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-4">No recent activity</div>
        ) : (
          activities.slice(0, 20).map((activity) => (
            <div key={activity.id} className="flex items-start gap-2 text-xs">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${getActivityColor(activity.type)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${getActivityColor(activity.type)}`}>
                    {activity.source}
                  </span>
                  <span className="text-slate-500">{getTimeSince(activity.timestamp)}</span>
                </div>
                <div className="text-slate-300 mt-0.5">{activity.message}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ActivityFeed
