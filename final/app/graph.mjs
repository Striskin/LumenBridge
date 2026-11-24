const concepts = {
  'Tablet': ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'],
  'Repair ticket': ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'],
  'Lesson': ['T01', 'T02', 'T03', 'T04', 'T05', 'T06'],
  'Learner': ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'G02', 'G06'],
  'Device loan': ['G01', 'G04', 'G05'],
  'Approval': ['G01', 'G02', 'G03', 'G04', 'G05', 'G06'],
  'Personal data': ['G02', 'G06'],
  'Access review': ['G02', 'G03', 'G06']
};

export function buildGraph(docs) {
  const nodes = [
    ...docs.map(doc => ({ id: doc.id, label: doc.title, type: 'Document' })),
    ...Object.keys(concepts).map(id => ({ id, label: id, type: 'Concept' })),
    ...[...new Set(docs.map(doc => doc.category))].map(id => ({ id, label: id, type: 'Category' }))
  ];
  const edges = docs.map(doc => ({ from: doc.id, to: doc.category, label: 'classified as' }));
  for (const [concept, ids] of Object.entries(concepts)) {
    for (const id of ids) edges.push({ from: id, to: concept, label: 'describes' });
  }
  for (const [from, to, label] of [
    ['Lesson', 'Learner', 'supports'], ['Lesson', 'Tablet', 'can use'],
    ['Device loan', 'Tablet', 'assigns'], ['Device loan', 'Approval', 'requires'],
    ['Repair ticket', 'Tablet', 'records work on'], ['Personal data', 'Learner', 'relates to'],
    ['Access review', 'Personal data', 'safeguards']
  ]) edges.push({ from, to, label });
  const byId = new Map(nodes.map(node => [node.id, node]));
  return {
    nodes, edges, byId,
    neighbors(id) {
      return edges.filter(edge => edge.from === id || edge.to === id)
        .map(edge => ({ ...edge, node: byId.get(edge.from === id ? edge.to : edge.from) }));
    }
  };
}
