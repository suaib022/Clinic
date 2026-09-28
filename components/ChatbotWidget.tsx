'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ChatbotWidget() {
  const pathname = usePathname()
  const [show, setShow] = useState(true)

  useEffect(() => {
    // When the route changes, completely remove the widget from the DOM
    setShow(false)
    
    // Wait a short moment to ensure the browser paints the removal and 
    // the widget's internal scripts garbage-collect their floating UI.
    const timer = setTimeout(() => {
      setShow(true)
    }, 150)
    
    return () => clearTimeout(timer)
  }, [pathname])

  if (!show) return null

  return (
    <>
      {/* @ts-expect-error Custom element for ElevenLabs */}
      <elevenlabs-convai agent-id="agent_0801m3m5germeb8s6vcsfs3evnfg"></elevenlabs-convai>
    </>
  )
}
