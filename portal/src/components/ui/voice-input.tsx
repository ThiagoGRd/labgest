'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  placeholder?: string
  className?: string
}

export function VoiceInput({ onTranscript, placeholder = 'Clique no microfone para falar...', className = '' }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Verificar suporte ao Web Speech API
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      
      if (!SpeechRecognition) {
        setIsSupported(false)
        return
      }

      const recognition = new SpeechRecognition()
      recognition.lang = 'pt-BR'
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event: any) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimTranscript += result[0].transcript
          }
        }

        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript)
          onTranscript(finalTranscript)
        }
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [onTranscript])

  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setTranscript('')
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
