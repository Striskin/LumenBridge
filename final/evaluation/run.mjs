import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { trainClassifier } from '../app/model.mjs';
import { answerQuestion, buildRetrieval } from '../app/retrieval.mjs';
import { buildGraph } from '../app/graph.mjs';

const root = new URL('..', import.meta.url);
const load = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const docs = await load('app/corpus.json');
const cases = await load('evaluation/cases.json');
const classify = trainClassifier(docs);
const retrieval = buildRetrieval(docs);
const graph = buildGraph(docs);
const mean = numbers => numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
const ratio = (numerator, denominator) => denominator ? numerator / denominator : 0;
const scoreRows = rows => rows.map(({ doc, ...row }) => ({ id:doc.id, title:doc.title, ...row }));
const classification = docs.filter(doc => doc.split === 'test').map(doc => ({
  id:doc.id, actual:doc.category, predicted:classify(doc.text).category
}));
const classes = [...new Set(classification.map(row => row.actual))];
const classificationByCategory = classes.map(category => {
  const actual = classification.filter(row => row.actual === category);
  const predicted = classification.filter(row => row.predicted === category);
  const tp = actual.filter(row => row.predicted === category).length;
  return { category, tp, fp:predicted.length - tp, fn:actual.length - tp, precision:ratio(tp, predicted.length), recall:ratio(tp, actual.length) };
});
const recommendations = cases.recommendations.map(test => {
  const ranked = scoreRows(retrieval.recommend(test.seed, test.context));
  const hits = ranked.filter(row => test.relevant.includes(row.id)).length;
  return { ...test, ranked, hits, precisionAt3:hits / 3, recallAt3:hits / test.relevant.length };
});
const chatbot = cases.chatbot.map(test => {
  const { answer, sources } = answerQuestion(test.question, retrieval);
  const normalized = answer.toLowerCase();
  const passed = test.expectedSource
    ? sources.some(row => row.doc.id === test.expectedSource) && test.required.every(fragment => normalized.includes(fragment))
    : sources.length === 0 && /enough evidence/.test(normalized);
  const grounded = sources.every(row => row.evidence.split(/(?<=[.!?])\s+/).every(sentence => row.doc.text.includes(sentence)));
  return { ...test, answer, sources:scoreRows(sources), passed, grounded };
});
assert.equal(docs.filter(doc => doc.split === 'train').length, 12);
assert.equal(classify('qzxv blorf').category, 'Unclassified');
assert.equal(retrieval.recommend('D01', 'qzxv blorf')[0].score, retrieval.recommend('D01')[0].score);
assert.ok(recommendations.every(row => row.ranked.every(item => item.id !== row.seed)));
assert.ok(chatbot.every(row => row.grounded));
assert.ok(graph.edges.every(edge => graph.byId.has(edge.from) && graph.byId.has(edge.to)));
assert.deepEqual(graph.neighbors('G01').map(row => row.node.id).sort(), ['Approval', 'Device loan', 'Governance']);
const summary = {
  trainingDocuments:12, testDocuments:classification.length,
  accuracy:mean(classification.map(row => Number(row.actual === row.predicted))),
  macroPrecision:mean(classificationByCategory.map(row => row.precision)),
  macroRecall:mean(classificationByCategory.map(row => row.recall)),
  recommendationPrecisionAt3:mean(recommendations.map(row => row.precisionAt3)),
  recommendationRecallAt3:mean(recommendations.map(row => row.recallAt3)),
  recommendationHitsAt3:recommendations.filter(row => row.hits).length,
  chatPasses:chatbot.filter(row => row.passed).length,
  graphNodes:graph.nodes.length, graphEdges:graph.edges.length
};
const output = { summary, classificationByCategory, classification, recommendations, chatbot };
await writeFile(new URL('evidence/evaluation.json', root), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
for (const row of recommendations) console.log(row.id, row.ranked.map(x => `${x.id} ${x.score.toFixed(3)}`).join(' | '), 'expected:', row.relevant.join(' '));
for (const row of chatbot) console.log(row.id, row.passed ? 'PASS' : 'FAIL', row.answer.replace(/\n+/g, ' '));
