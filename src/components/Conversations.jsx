import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function Conversations({ currentUser, onSelectConversation, onClose }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversations()
  }, [currentUser])

  const fetchConversations = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        setConversations([])
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        setConversations([])
        setLoading(false)
        return
      }

      const partnerIds = [...new Set(data.map(msg =>
        msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id
      ))]

      const { data: partners } = await supabase
        .from('users')
        .select('id, name')
        .in('id', partnerIds)

      const partnerMap = Object.fromEntries((partners || []).map(p => [p.id, p.name]))

      const grouped = {}
      for (const msg of data) {
        const partnerId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id
        if (!grouped[partnerId]) {
          grouped[partnerId] = {
            id: partnerId,
            name: partnerMap[partnerId] || 'Unknown',
            lastMessage: msg.content,
            lastTime: msg.created_at,
          }
        }
      }

      setConversations(Object.values(grouped))
      setLoading(false)
    } catch {
      setConversations([])
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white p-4 flex items-center justify-between flex-shrink-0">
        <h2 className="font-bold text-lg">Messages</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-center text-gray-500 text-sm p-4">Loading...</p>
        ) : conversations.length === 0 ? (
          <div className="text-center text-gray-500 p-8">
            <p className="text-2xl mb-2">💬</p>
            <p className="text-sm font-medium">No conversations yet</p>
            <p className="text-xs mt-1 text-gray-400">Start chatting with a farmer!</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id, conv.name)}
              className="w-full text-left border-b border-gray-100 p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--color-primary-dark)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {conv.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-900 truncate">{conv.name}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage}</p>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(conv.lastTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default Conversations