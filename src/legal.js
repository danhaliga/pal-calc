'use strict';
/* Paginile legale: termeni, confidențialitate (GDPR), cookie-uri.
   Obligatorii pentru un site care vinde online în România. Textul e în
   română — limba contractului; legăturile din subsol sunt traduse. */
const express = require('express');
const FIRMA = require('./firma');
const router = express.Router();

[['termeni', 'legal.termeni'], ['confidentialitate', 'legal.confidentialitate'], ['cookies', 'legal.cookies']]
  .forEach(([pag, titlu]) => {
    router.get('/' + pag, (req, res) => {
      res.render('legal/' + pag, { title: req.t(titlu), firma: FIRMA });
    });
  });

module.exports = { router, FIRMA };
