/** Custo corrente da receita; não altera valores históricos das ordens. */
export function calcularCustoMateriais(
  materiais: ReadonlyArray<{ id: number; quantidade: number }>,
  precos: ReadonlyArray<{ id: number; precoUnitario: number | null }>,
) {
  const porId = new Map(precos.map(item => [item.id, item.precoUnitario]))
  if (materiais.some(material => porId.get(material.id) == null)) return null
  return materiais.reduce((total, material) => total + (porId.get(material.id) ?? 0) * material.quantidade, 0)
}
