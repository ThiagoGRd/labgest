'use client'

import { useState, useRef, useEffect, useEffectEvent, useSyncExternalStore } from 'react'
import { Mic, MicOff } from 'lucide-react'

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionErrorLike {
  error: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

const subscribeToBrowserSupport = () => () => undefined
const getBrowserSupport = () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
const getServerSupport = () => true

interface VoiceInputProps {
  onTranscript: (text: string) => void
  placeholder?: string
  className?: string
}

export function VoiceInput({ onTranscript, placeholder = 'Clique no microfone para falar...', className = '' }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const isSupported = useSyncExternalStore(subscribeToBrowserSupport, getBrowserSupport, getServerSupport)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const handleTranscript = useEffectEvent((text: string) => onTranscript(text))

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        }
      }

      if (finalTranscript) {
        handleTranscript(finalTranscript)
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [isSupported])

  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  if (!isSupported) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-400 ${className}`}>
        <MicOff className="h-4 w-4" />
        <span>Entrada por voz não suportada neste navegador</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      title={placeholder}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
        isListening
          ? 'bg-red-100 text-red-600 border-2 border-red-300 animate-pulse'
          : 'bg-emerald-50 text-emerald-600 border-2 border-emerald-200 hover:bg-emerald-100'
      } ${className}`}
    >
      {isListening ? (
        <>
          <div className="relative">
            <Mic className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
          </div>
          <span>Gravando... Clique para parar</span>
        </>
      ) : (
        <>
          <Mic className="h-5 w-5" />
          <span>Falar observações</span>
        </>
      )}
    </button>
  )
}
