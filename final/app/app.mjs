import { trainClassifier } from './model.mjs';
import { answerQuestion, buildRetrieval } from './retrieval.mjs';
import { buildGraph } from './graph.mjs';

const view = document.querySelector('#view');
const status = document.querySelector('#status');
const prompts = [
  'How do I restart a frozen tablet before a factory reset?',
  'How can I adapt a reading lesson with large text and audio?',
  'What approval and return records are needed for a device loan?'
];

function element(tag, text, classes) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (classes) node.className = classes;
  return node;
}
function button(label, act, classes = '') {
  const node = element('button', label, classes);
  node.type = 'button';
  node.addEventListener('click', act);
  return node;
}
function group(...children) {
  const node = element('div', '', 'actions');
  node.append(...children);
  return node;
}
function panel(title, ...children) {
  const node = element('section', '', 'panel');
  node.append(element('h2', title), ...children);
  return node;
}
function intro(label, title, description) {
  const node = element('header', '', 'intro');
  node.append(element('span', label, 'eyebrow'), element('h1', title), element('p', description));
  return node;
}
function layout(left, right) {
  const node = element('div', '', 'layout');
  node.append(left, right);
  return node;
}
function inputField(id, label, multiline = false) {
  const field = element(multiline ? 'textarea' : 'input');
  field.id = id;
  field.maxLength = multiline ? 5000 : 300;
  const caption = element('label', label);
  caption.htmlFor = id;
  return [caption, field];
}
function formWith(label, action, ...children) {
  const form = element('form');
  const submit = element('button', label);
  submit.type = 'submit';
  form.append(...children, group(submit));
  form.addEventListener('submit', event => {
    event.preventDefault();
    action();
  });
  return form;
}
function entry(title, details) {
  const row = element('article', '', 'entry');
  row.append(element('h3', title), element('small', details));
  return row;
}
const format = score => score.toFixed(3);

async function start() {
  const response = await fetch('./corpus.json');
  if (!response.ok) throw new Error('Document repository unavailable');
  const docs = await response.json();
  const byId = new Map(docs.map(doc => [doc.id, doc]));
  const classify = trainClassifier(docs);
  const retrieval = buildRetrieval(docs);
  const graph = buildGraph(docs);
  const state = { doc: 'D01', node: 'G01', category: 'All', context: '', question: '', chat: null, text: '', classification: null };
  const categories = [...new Set(docs.map(doc => doc.category))];
  const pages = { assistant, documents, classify: classifyPage, graph: graphPage };
  status.textContent = `${docs.length} sample documents`;

  function navigate(page, patch = {}, focusHeading = true) {
    Object.assign(state, patch);
    if (location.hash !== '#' + page) history.pushState(null, '', '#' + page);
    render();
    if (focusHeading) view.querySelector('h1')?.focus();
  }
  function docButton(id) {
    return button('Open source', () => navigate('documents', { doc: id, category: 'All' }), 'text');
  }
  function graphButton(id) {
    return button('View relationships', () => navigate('graph', { node: id }), 'text');
  }
  function assistant() {
    const [label, field] = inputField('question', 'Ask a question');
    field.value = state.question;
    field.required = true;
    field.placeholder = 'Ask about a repair, lesson, or policy…';
    function run(question) {
      if (!question.trim()) {
        field.setCustomValidity('Enter a question.');
        field.reportValidity();
        return;
      }
      state.question = question.trim();
      state.chat = answerQuestion(state.question, retrieval);
      if (state.chat.sources.length) state.context = state.question;
      render();
      view.querySelector('#answer-title').focus();
    }
    field.addEventListener('input', () => field.setCustomValidity(''));
    const left = panel('Question', formWith('Get answer', () => run(field.value), label, field));
    if (state.chat) {
      const result = element('section', '', 'result');
      const heading = element('h2', 'Assistant answer');
      heading.id = 'answer-title';
      heading.tabIndex = -1;
      result.append(heading, element('p', state.chat.answer, 'answer'));
      for (const source of state.chat.sources) {
        const row = entry(`${source.doc.id} · ${source.doc.title}`, `Cosine similarity ${format(source.score)} · ${source.doc.owner}`);
        row.append(group(docButton(source.doc.id), graphButton(source.doc.id)));
        result.append(row);
      }
      left.append(result);
    }
    const examples = element('div', '', 'examples');
    for (const prompt of prompts) examples.append(button(prompt, () => run(prompt), 'secondary'));
    return [intro('NATURAL LANGUAGE QUERIES', 'Ask the assistant', 'Get answers grounded in LumenBridge’s sample documents.'), layout(left, panel('Example questions', examples))];
  }
  function documents() {
    const doc = byId.get(state.doc);
    const left = panel('Document repository');
    const filters = element('div', '', 'filters');
    for (const category of ['All', ...categories]) {
      const option = button(category, () => {
        const prior = byId.get(state.doc);
        const next = category !== 'All' && prior.category !== category ? docs.find(item => item.category === category).id : state.doc;
        navigate('documents', { category, doc: next }, false);
        view.querySelector('.filters .active').focus();
      }, category === state.category ? 'active' : 'secondary');
      option.setAttribute('aria-pressed', String(category === state.category));
      filters.append(option);
    }
    const list = element('div', '', 'doc-list');
    for (const item of docs.filter(item => state.category === 'All' || item.category === state.category)) {
      const row = element('div', '', 'entry');
      const info = element('div');
      info.append(element('h3', item.title), element('small', `${item.id} · ${item.category}`));
      row.append(info, button(item.id === doc.id ? 'Selected' : 'Open', () => {
        navigate('documents', { doc: item.id }, false);
        view.querySelector('#selected-doc').focus();
      }, item.id === doc.id ? 'active' : 'text'));
      list.append(row);
    }
    left.append(filters, list);
    const side = element('aside');
    const detail = panel(`${doc.id} · ${doc.title}`, element('p', `${doc.category} · ${doc.owner}`, 'muted'), element('p', doc.text));
    detail.querySelector('h2').id = 'selected-doc';
    detail.querySelector('h2').tabIndex = -1;
    detail.append(group(graphButton(doc.id), button('Classify this text', () => navigate('classify', { text: doc.text, classification: classify(doc.text) }), 'text')));
    const [label, field] = inputField('context', 'Search context (optional)');
    field.value = state.context;
    field.placeholder = 'e.g. approval and return records';
    const recs = panel('Related documents', formWith('Rank documents', () => {
      state.context = field.value.trim();
      render();
      view.querySelector('#context').focus();
    }, label, field));
    const matches = retrieval.recommend(doc.id, state.context);
    if (state.context) recs.append(element('p', 'Ranking can use 70% document similarity and 30% context similarity when context terms match the corpus.', 'status-line'));
    if (!matches.length) recs.append(element('p', 'No related documents found.', 'status-line'));
    for (const row of matches) {
      const result = entry(`${row.doc.id} · ${row.doc.title}`, `Rank score ${format(row.score)} · Document cosine ${format(row.similarity)}${state.context ? ' · Context cosine ' + format(row.contextScore) : ''} · Terms ${row.terms.join(', ')}`);
      result.append(group(button('Open recommendation', () => navigate('documents', { doc: row.doc.id, category: 'All' }), 'text')));
      recs.append(result);
    }
    side.append(detail, recs);
    return [intro('REPOSITORY AND RECOMMENDATIONS', 'Browse documents', 'Read a source and find related material from its content and your current query.'), layout(left, side)];
  }
  function classifyPage() {
    const [label, field] = inputField('document-text', 'Document text', true);
    field.required = true;
    field.value = state.text;
    field.placeholder = 'Paste a short policy, teaching guide, or support note…';
    field.addEventListener('input', () => field.setCustomValidity(''));
    function run(text) {
      if (!text.trim()) {
        field.setCustomValidity('Enter document text.');
        field.reportValidity();
        return;
      }
      state.text = text;
      state.classification = classify(text);
      render();
      view.querySelector('#prediction').focus();
    }
    const left = panel('Classify text', formWith('Predict category', () => run(field.value), label, field));
    if (state.classification) {
      const result = element('div', '', 'result');
      const title = element('h2', state.classification.category);
      title.id = 'prediction';
      title.tabIndex = -1;
      result.append(title);
      if (state.classification.terms.length) {
        result.append(element('p', 'Recognized terms: ' + state.classification.terms.join(', ')));
        result.append(group(button('Explore category', () => navigate('graph', { node: state.classification.category }), 'text')));
      } else result.append(element('p', 'None of the input words matched the training vocabulary.'));
      left.append(result);
    }
    const examples = element('div', '', 'examples');
    for (const id of ['D05', 'T05', 'G05']) {
      const doc = byId.get(id);
      examples.append(button(doc.title, () => run(doc.text), 'secondary'));
    }
    const right = panel('Held-out examples', element('p', 'These samples are excluded from training.', 'split-note'), examples);
    return [intro('AUTOMATED CLASSIFICATION', 'Classify a document', 'Predict Device Support, Inclusive Teaching, or Governance from document text.'), layout(left, right)];
  }
  function graphPage() {
    const current = graph.byId.get(state.node);
    const relations = graph.neighbors(current.id);
    const left = panel('Relationship explorer');
    left.classList.add('graph-panel');
    const label = element('label', 'Focus node');
    label.htmlFor = 'focus-node';
    const select = element('select');
    select.id = 'focus-node';
    for (const type of ['Document', 'Concept', 'Category']) {
      const optgroup = element('optgroup');
      optgroup.label = type;
      for (const node of graph.nodes.filter(node => node.type === type)) {
        const option = element('option', node.type === 'Document' ? `${node.id} · ${node.label}` : node.label);
        option.value = node.id;
        optgroup.append(option);
      }
      select.append(optgroup);
    }
    select.value = current.id;
    const focus = id => {
      navigate('graph', { node: id }, false);
      view.querySelector('#focus-node').focus();
    };
    select.addEventListener('change', () => focus(select.value));
    left.append(label, select, graphSvg(current, relations, focus));
    const legend = element('div', '', 'legend');
    for (const [type, key] of [['Document','doc'],['Concept','concept'],['Category','category']]) {
      const item = element('span');
      item.append(element('i', '', `dot ${key}`), document.createTextNode(type));
      legend.append(item);
    }
    left.append(legend);
    const right = panel(current.label, element('p', `${current.type} · ${relations.length} connections`, 'muted'));
    if (current.type === 'Document') right.append(group(docButton(current.id)));
    const items = element('div', '', 'relationship-list');
    for (const item of relations) {
      const direction = item.from === current.id ? `${item.label} →` : `← ${item.label}`;
      const row = entry(item.node.label, direction + ' · ' + item.node.type);
      row.append(group(button('Focus ' + (item.node.type === 'Document' ? item.node.id : item.node.label), () => focus(item.node.id), 'text')));
      items.append(row);
    }
    right.append(items);
    return [intro('KNOWLEDGE GRAPH', 'Explore the graph', 'Follow connections among documents, concepts, and categories.'), layout(left, right)];
  }
  function render() {
    const requested = location.hash.slice(1);
    const page = Object.hasOwn(pages, requested) ? requested : 'assistant';
    view.replaceChildren(...pages[page]());
    view.querySelector('h1').tabIndex = -1;
    for (const link of document.querySelectorAll('nav a')) {
      if (link.hash === '#' + page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    view.setAttribute('aria-busy', 'false');
  }
  addEventListener('popstate', render);
  addEventListener('hashchange', render);
  render();
}

function graphSvg(current, relations, focus) {
  const svgNode = (tag, attrs) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const svg = svgNode('svg', {viewBox: '0 0 640 390', 'aria-label': 'Interactive diagram for ' + current.label});
  const positions = relations.map((item, index) => {
    const angle = 2 * Math.PI * index / relations.length - Math.PI / 2;
    return { ...item, x: 320 + 214 * Math.cos(angle), y: 191 + 133 * Math.sin(angle) };
  });
  for (const point of positions) svg.append(svgNode('line', { x1: 320, y1: 191, x2: point.x, y2: point.y }));
  const colors = { Document:'#368a78', Concept:'#d5a04e', Category:'#7583b6' };
  function draw(node, x, y, active = false) {
    const group = svgNode('g', active ? {} : { class: 'svg-node', role: 'button', tabindex: 0, 'aria-label': 'Focus ' + node.label });
    group.append(svgNode('circle', { cx:x, cy:y, r:active ? 15 : 10, fill:colors[node.type] }));
    const label = svgNode('text', { x, y:y + 32, 'text-anchor':'middle' });
    label.textContent = node.type === 'Document' && !active ? node.id : node.label;
    group.append(label);
    if (!active) {
      group.addEventListener('click', () => focus(node.id));
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          focus(node.id);
        }
      });
    }
    svg.append(group);
  }
  draw(current, 320, 191, true);
  for (const point of positions) draw(point.node, point.x, point.y);
  return svg;
}

start().catch(() => {
  status.textContent = 'Repository unavailable';
  view.setAttribute('aria-busy', 'false');
  view.append(element('p', 'The sample documents could not load. Start the local server using the README instructions.', 'prereq'));
});
