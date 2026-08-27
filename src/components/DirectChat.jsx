import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { notify } from '../lib/notifications'

function DirectChat({ conversationWith, conversationName, currentUser, orderId, onClose }) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 1500)
    return () => clearInterval(interval)
  }, [conversationWith])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${conversationWith}),and(sender_id.eq.${conversationWith},receiver_id.eq.${currentUser.id})`
        )
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Fetch error:', error)
        setLoading(false)
        return
      }

      setMessages(data || [])
      setLoading(false)
      setTimeout(scrollToBottom, 100)

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', currentUser.id)
        .eq('sender_id', conversationWith)
        .eq('read', false)

    } catch (err) {
      console.error('Fetch exception:', err)
      setLoading(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    setSending(true)
    const messageContent = inputValue

    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: conversationWith,
        order_id: orderId || null,
        content: messageContent,
      })

      setSending(false)

      if (error) {
        console.error('Send error:', error)
        notify.error('Failed to send message')
      } else {
        notify.success('Message sent!')
        setInputValue('')
        await fetchMessages()
      }
    } catch (err) {
      setSending(false)
      console.error('Send exception:', err)
      notify.error('Error sending message')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-full bg-white rounded-lg shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white p-4 flex items-center justify-between">
        <div>
          <h3 className="font-[var(--font-heading)] text-lg font-bold">
            {conversationName}
          </h3>
          <p className="text-xs text-green-100">Online</p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-white to-[#F9F9F9]">
        <AnimatePresence>
          {loading ? (
            <p className="text-center text-gray-500 text-sm">Loading chat...</p>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-3 rounded-2xl text-sm break-words ${
                    msg.sender_id === currentUser.id
                      ? 'bg-[var(--color-primary)] text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-900 rounded-bl-none'
                  }`}
                >
                  <p>{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    msg.sender_id === currentUser.id ? 'text-green-100' : 'text-gray-600'
                  }`}>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-gray-200 bg-white p-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 transition-all"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !inputValue.trim()}
            className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:brightness-95 disabled:opacity-60 transition-all"
          >
            {sending ? '⏳' : '✓'}
          </button>
        </div>
      </form>
    </motion.div>
  )
}

export default DirectChat