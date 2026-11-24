const stop = new Set('a an and are as at be before by for from how in is it of on or that the this to use what with'.split(' '));

export function tokens(text) {
  return (text.toLowerCase().match(/[a-z]{2,}/g) ?? []).filter(word => !stop.has(word));
}

export function fitVectorizer(texts) {
  const frequencies = new Map();
  for (const text of texts) {
    for (const term of new Set(tokens(text))) {
      frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map([...frequencies].map(([term, count]) => [
    term, Math.log((1 + texts.length) / (1 + count)) + 1
  ]));
  return {
    vocabulary: [...idf.keys()],
    transform(text) {
      const weights = new Map();
      for (const term of tokens(text)) {
        if (idf.has(term)) weights.set(term, (weights.get(term) ?? 0) + idf.get(term));
      }
      const norm = Math.hypot(...weights.values());
      return new Map([...weights].map(([term, weight]) => [term, weight / norm]));
    }
  };
}

export function cosine(left, right) {
  return [...left].reduce((score, [term, weight]) => score + weight * (right.get(term) ?? 0), 0);
}

export function trainClassifier(docs) {
  const training = docs.filter(doc => doc.split === 'train');
  const vectorizer = fitVectorizer(training.map(doc => doc.text));
  const classes = [...new Set(training.map(doc => doc.category))].sort();
  const models = classes.map(category => {
    const examples = training.filter(doc => doc.category === category);
    const totals = new Map();
    for (const doc of examples) {
      for (const [term, weight] of vectorizer.transform(doc.text)) {
        totals.set(term, (totals.get(term) ?? 0) + weight);
      }
    }
    const mass = [...totals.values()].reduce((sum, weight) => sum + weight, 0);
    return { category, totals, denominator: mass + vectorizer.vocabulary.length, prior: Math.log(examples.length / training.length) };
  });
  return text => {
    const vector = vectorizer.transform(text);
    if (!vector.size) return { category: 'Unclassified', terms: [] };
    const scores = models.map(({ category, totals, denominator, prior }) => ({
      category,
      score: [...vector].reduce((sum, [term, weight]) => sum + weight * Math.log(((totals.get(term) ?? 0) + 1) / denominator), prior)
    }));
    scores.sort((a, b) => b.score - a.score);
    const terms = [...vector].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([term]) => term);
    return { category: scores[0].category, terms };
  };
}
