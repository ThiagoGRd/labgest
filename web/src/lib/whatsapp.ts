export async function sendWhatsAppMessage(phone: string, message: string) {
  const apiUrl = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE

  if (!apiUrl || !apiKey || !instance) {
    console.warn('Evolution API não configurada')
    return { success: false, error: 'API não configurada' }
  }

  // Formatar telefone (adicionar 55 se não tiver)
  let number = phone.replace(/\D/g, '')
  if (number.length <= 11) {
    number = '55' + number
  }

  try {
    const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: number,
        options: {
          delay: 1200,
          presence: 'composing',
          linkPreview: false,
        },
        textMessage: {
          text: message,
        },
      }),
    })

    const data = await response.json()
    
    if (response.ok) {
      return { success: true, data }
    } else {
      console.error('Erro Evolution API:', data)
      return { success: false, error: 'Falha ao enviar mensagem' }
    }
  } catch (error) {
    console.error('Erro ao conectar com Evolution API:', error)
    return { success: false, error: 'Erro de conexão' }
  }
}
