import ignore from 'ignore';
console.log("backend/app/main.py matching *backend/*** ? ", ignore().add('*backend/***').ignores('backend/app/main.py'));
