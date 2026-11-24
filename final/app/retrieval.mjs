import { cosine, fitVectorizer, tokens } from './model.mjs';

const order = (a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id);

export function buildRetrieval(docs) {
  const vectorizer = fitVectorizer(docs.map(doc => doc.text));
  const vectors = new Map(docs.map(doc => [doc.id, vectorizer.transform(doc.text)]));
  function matchTerms(left, right) {
    return [...left].filter(([term]) => right.has(term))
      .sort(([a, x], [b, y]) => y * right.get(b) - x * right.get(a))
      .slice(0, 5).map(([term]) => term);
  }
  function search(query, limit = 3) {
    const queryVector = vectorizer.transform(query);
    return docs.map(doc => {
      const vector = vectors.get(doc.id);
      return { doc, score: cosine(queryVector, vector), terms: matchTerms(queryVector, vector) };
    }).filter(row => row.score > 0).sort(order).slice(0, limit);
  }
  function recommend(seedId, context = '', limit = 3) {
    const seed = vectors.get(seedId);
    const query = vectorizer.transform(context);
    if (!seed && !query.size) return [];
    return docs.filter(doc => doc.id !== seedId).map(doc => {
      const vector = vectors.get(doc.id);
      const similarity = seed ? cosine(seed, vector) : 0;
      const contextScore = cosine(query, vector);
      const score = seed && query.size ? 0.7 * similarity + 0.3 * contextScore : similarity + contextScore;
      const terms = [...new Set([...matchTerms(query, vector), ...matchTerms(seed ?? query, vector)])].slice(0, 5);
      return { doc, score, similarity, contextScore, terms };
    }).filter(row => row.score > 0).sort(order).slice(0, limit);
  }
  return { search, recommend, vectorize: vectorizer.transform };
}

const generic = new Set('can could do does get help me my our please should tell want we when where which who will would you'.split(' '));

export function answerQuestion(question, retrieval) {
  const search = retrieval.search(question);
  const intent = new Set(tokens(question).filter(word => !generic.has(word)));
  const covered = [...intent].filter(word => retrieval.vectorize(question).has(word)).length;
  if (!search.length || search[0].score < 0.16 || covered < Math.min(intent.size, 2)) {
    return { answer: 'I could not find enough evidence in the LumenBridge documents to answer that. Try asking about device support, inclusive teaching, or governance.', sources: [] };
  }
  const chosen = search.slice(0, 2).filter(row => row.score >= search[0].score * 0.64);
  const sources = chosen.flatMap((row, index) => {
    const overlap = sentence => new Set(tokens(sentence).filter(word => intent.has(word))).size;
    const sentences = row.doc.text.match(/[^.!?]+[.!?]?/g)?.map(s => s.trim()).filter(Boolean) ?? [];
    const best = sentences.map((sentence, position) => ({ sentence, position, hits: overlap(sentence) }))
      .filter(s => s.hits > 0).sort((a, b) => b.hits - a.hits || a.position - b.position)
      .slice(0, index === 0 ? 3 : 1).sort((a, b) => a.position - b.position);
    return best.length ? [{ ...row, evidence: best.map(item => item.sentence).join(' ') }] : [];
  });
  return { answer: sources.map(row => `${row.evidence} [${row.doc.id}]`).join('\n\n'), sources };
}
