# Plano registrado antes do código
Base: b8ee4012a140079bef32b3c2103479b6576e346f. Branch: ui/contextual-attention.

1. Testes de regressão primeiro: atalhos com contexto, precedência da atenção e relatório recolhido; consultas sintéticas coerentes com contagens (incluindo pausados, prova e múltiplos ciclos).
2. Compartilhar apenas os critérios dos quatro cartões. Prioridades reutiliza ordensComPrazoVencido sem deduplicar/excluir prova no contexto. Produção consulta os ciclos respondidos completos no contexto (não apenas ciclo mais recente) e ordens sem etapa exata.
3. Seleção na URL `atencao`, validada por página; limpar remove só essa chave. Seleção contextual tem busca própria e estado vazio. Filas padrão preservadas.
4. Atenção antes das métricas; relatório mensal recolhido depois dos filtros em Ordens, mantendo handler de navegação.
5. Rodar testes existentes, verificações estáticas disponíveis e harness local com dados fictícios se viável. Nenhuma ação real, banco ou env carregado. Registrar limites sem alegar E2E real.

Testes: quatro links, ausência/invalidade de parâmetro, consulta/contagem, busca e vazio, limpar preservando parâmetros, navegação direta/recarregar/histórico; relatórios com/sem clínica; desktop/mobile. Browser usará componentes reais com dependências externas bloqueadas/simuladas se ferramentas disponíveis.
