# Guia de Teste - Workflow de Provas com Fotos

## O que foi implementado

### 1. Backend (Funcional)
- ✅ Schema atualizado com campo `fotosProva` (JSON array)
- ✅ Server actions: `uploadFotoProva`, `getFotosProva`, `avancarEtapa`, `retornarEtapa`
- ✅ Upload para Supabase Storage (bucket: `ordens/fotos-prova/`)
- ✅ Logs de debug no console do navegador

### 2. Frontend (LabGest)
- ✅ **Workflow Modal** - Botão "Fotos da Prova" em etapas de prova
- ✅ **PhotoComparison** - Componente de comparação lado a lado
  - Upload de 2 fotos (referência + atual)
  - Zoom (50%-200%)
  - Rotação (90° em 90°)
  - Checklist de aprovação (7 itens clínicos)
  - Campo de observações

## Como Testar

### Passo 1: Criar uma ordem de Protocolo
```
1. Acesse /ordens
2. Clique em "Nova Ordem"
3. Selecione um serviço com "Protocolo" no nome
4. Preencha os dados e crie
```

### Passo 2: Abrir o Workflow
```
1. Na tabela, clique no botão GitBranch (ícone roxo) na coluna Ações
2. O modal de workflow vai abrir mostrando as 10 etapas
```

### Passo 3: Avançar até uma etapa de prova
```
1. Clique em "Avançar Etapa" até chegar em "Prova da Estrutura" ou "Prova Estética"
2. As etapas de prova têm badge laranja "Prova"
```

### Passo 4: Upload das Fotos
```
1. Na etapa de prova, clique no botão "📤 Fotos da Prova"
2. Um modal vai abrir com 2 áreas de upload:
   - Esquerda: Prova anterior (ou referência)
   - Direita: Prova atual
3. Clique em cada área para upload
4. As fotos são salvas no Supabase automaticamente
```

### Passo 5: Comparar e Aprovar
```
1. Use os controles de Zoom e Rotação para comparar detalhes
2. Preencha o Checklist de Aprovação:
   - [ ] DVO correta
   - [ ] Linha média centralizada
   - [ ] Corredor bucal adequado
   - [ ] Contorno gengival harmonioso
   - [ ] Contatos oclusais adequados
   - [ ] Estética do sorriso aprovada
   - [ ] Fonética testada
3. Se tudo OK → "✅ Aprovar Prova"
4. Se precisar ajustes → "⚠️ Enviar com Observações"
```

### Passo 6: Devolver para Ajuste (se necessário)
```
1. No workflow modal, clique em "← Devolver para Ajuste"
2. Digite o motivo (ex: "DVO aumentada em 2mm")
3. Confirme
4. A ordem volta para a etapa anterior e incrementa o contador de tentativas
```

## Debug (se não funcionar)

### Abrir Console do Navegador
```
F12 → Console
```

### Procure por:
```
[WorkflowModal] Avançando etapa...
[WorkflowModal] Checklist salvo: {...}
[WorkflowModal] Resultado avancarEtapa: {...}
```

### Erros comuns:
1. **"Ordem não encontrada"** → Verifique se a ordem tem `tipoWorkflow` definido
2. **"Complete o checklist"** → Marque todos os 7 itens do checklist estético
3. **Upload falhando** → Verifique se o bucket `ordens` existe no Supabase Storage

## Estrutura das Fotos no Banco

```json
{
  "fotosProva": [
    {
      "url": "https://...supabase.co/storage/v1/object/public/ordens/fotos-prova/...",
      "numeroProva": 1,
      "descricao": "Prova 1",
      "dataUpload": "2026-02-19T...",
      "etapa": "Prova Estética"
    }
  ]
}
```

## Próximos Passos (Portal do Dentista)

Se quiser que o dentista acesse remotamente:
1. Criar rota `/portal/provas/:ordemId` com autenticação por token
2. Dentista recebe link por WhatsApp/Email
3. Acessa sem login, só com token da ordem
4. Faz upload das fotos e preenche checklist
5. LabGest recebe notificação
