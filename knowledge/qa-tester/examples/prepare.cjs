// prepare.cjs: copies the team's tested modules into smoke-app/ so it uses the SAME code:
//   ../../opencv-expert/examples/scanner-pipeline.js  and  ../../indexeddb-expert/examples/db.js
// Run once before serving smoke-app: node prepare.cjs
const fs = require('fs'), path = require('path');
const here = __dirname, app = path.join(here, 'smoke-app');
fs.copyFileSync(path.join(here, '../../opencv-expert/examples/scanner-pipeline.js'), path.join(app, 'scanner-pipeline.js'));
fs.copyFileSync(path.join(here, '../../indexeddb-expert/examples/db.js'), path.join(app, 'db.js'));
console.log('copied scanner-pipeline.js and db.js into smoke-app/');
