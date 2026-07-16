/* Copies the Postman collection into test-ui as a plain script.
   The console is served from /test-ui but postman/ isn't, so it can't fetch
   the collection at runtime — this embeds it instead.

   Run after changing the collection:  npm run test-ui:sync            */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'postman', 'nukhba_alawael.postman_collection.json');
const out = path.join(__dirname, 'collection.js');

const raw = fs.readFileSync(src, 'utf8');
const collection = JSON.parse(raw); // fail loudly on malformed JSON

let count = 0;
(function walk(items) {
  for (const it of items) it.item ? walk(it.item) : count++;
})(collection.item);

fs.writeFileSync(
  out,
  '/* GENERATED — do not edit. Source: postman/nukhba_alawael.postman_collection.json\n' +
    `   ${count} requests, synced ${new Date().toISOString().slice(0, 10)}.\n` +
    '   Refresh with: npm run test-ui:sync */\n' +
    'window.__COLLECTION__ = ' +
    JSON.stringify(collection) +
    ';\n',
);

console.log(`test-ui/collection.js <- ${count} requests`);
