# AP Five-Course Study Guide

A single-page study guide with notes, practice questions and a score report for:

- AP Macroeconomics, Units 1–3
- AP Chemistry, Units 1–3
- AP Biology, Units 1–3
- AP United States History: APUSH 1 (Units 1–5, 1491–1877) and APUSH 2 (Units 6–9, 1865–present)
- AP Calculus AB, Units 1–3

`index.html` is the whole site. It is generated; edit the files in `source/` and rebuild instead of editing it by hand.

## Rebuild

```
cd source/build
npm install
node build.js
python3 ../check/verify.py ../dist/data.json   # recomputes every calculation answer (needs sympy)
cp ../dist/site/index.html ../../index.html
```

- `source/content/*.txt` holds the notes and questions, one file per course. `x-extra.txt` adds notes and questions to existing topics.
- `source/build/page.css` and `page.js` are the page's styles and behaviour.

Pushing to `main` deploys to Vercel.
