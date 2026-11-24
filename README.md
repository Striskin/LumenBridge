# LumenBridge Knowledge Management System

MAPS final delivery for LumenBridge Learning Services. The course prototype integrates automated classification, document recommendations, a source-grounded assistant, and an interactive knowledge graph. It uses the same 18 synthetic documents and three categories as the project progress submission.

## Run the final app

1. Extract the entire ZIP. Open a terminal in this folder.
2. On Windows, double-click `Start_LumenBridge.cmd`. From a terminal, run `python final/run_app.py`. On Windows, `py final/run_app.py` also works.
3. Open http://127.0.0.1:8000 in a modern browser. If that port is busy, use `python final/run_app.py --port 8001`.

Python 3.10+ serves the files locally. No packages, hosting account, API key, or external model is required. The app fetches its bundled JSON over local HTTP, so open the address displayed by the server.

## Demo workflow

1. Under **Classify a document**, select **Frozen screen recovery** to predict Device Support and open its category in the graph.
2. Under **Ask the assistant**, choose the device-loan example. Open its G01 citation to see the original policy.
3. In **Browse documents**, set Search context to `loan approval and return signature` and choose **Rank documents**. G05 ranks first. Inspect the document similarity, context similarity, and matched terms.
4. Open **View relationships** on G01 to see its Governance, Device loan, and Approval links. Move between nodes using the diagram, keyboard, focus menu, or relationship list.
5. Ask the assistant when payroll deposits salaries. The corpus has insufficient evidence and the app says so.

## Source and evidence

| Path | Purpose |
| --- | --- |
| `final/app/index.html`, `style.css`, `app.mjs` | Integrated browser interface and routes |
| `final/app/model.mjs` | Phase I TF-IDF and multinomial Naive Bayes logic |
| `final/app/retrieval.mjs` | Cosine search, contextual recommendations, extractive chatbot |
| `final/app/graph.mjs` | Document, concept, category nodes and typed links |
| `final/app/corpus.json` | 18 Phase I texts, IDs, owners, versions, categories, and original 12/6 split |
| `final/evaluation/cases.json` | Labeled recommendation cases and answer checks |
| `final/evaluation/run.mjs` | Evaluation and consistency checks using the app modules |
| `final/evidence/` | Full evaluation output and four browser screenshots |
| `final/deliverables/` | Technical brief and executive presentation |
| `phase1/` | Original Python prototype, main Colab notebook, corpus, and tests |

## Reproduce the measurements

From this folder run `node final/evaluation/run.mjs` with Node.js 20 or newer. The script rewrites `final/evidence/evaluation.json`. The relevance sets in `cases.json` reflect the stated task intent. Precision@3 uses three slots per case and Recall@3 uses that case's labeled relevant set. This is a small synthetic evaluation.

The Phase I Python prototype can still be run from inside `phase1` with `python main.py --output-dir evidence/new_run`. From that same folder use `python -m unittest discover -s tests -v` for the original tests.

## Deployment and submission

This package is delivered locally. The graded Phase I repository is https://github.com/Striskin/Knowledge-Systems. To publish the final demo later, serve the contents of `final/app/` from the root of a static HTTPS host. Keep the corpus and ES modules in the same directory as `index.html`, and verify the four demo tasks at the hosted URL. The assignment separately asks for that deployed URL and a final repository link.
