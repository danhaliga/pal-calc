'use strict';
/* Ruleaza migratiile SQL. Se ruleaza si automat la pornirea serverului. */

require('dotenv').config();
const { migrate } = require('../src/db');

const n = migrate();
console.log(n > 0 ? `gata: ${n} migrări aplicate` : 'gata');
