const ignore = require('ignore');
console.log("backend/app/main.py matching *backend/* ? ", ignore().add('*backend/*').ignores('backend/app/main.py'));
console.log("backend/main.py matching *backend/* ? ", ignore().add('*backend/*').ignores('backend/main.py'));
