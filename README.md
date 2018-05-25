# DbSequel

```
/**
 * application: labti-server
 * module: models/mysql/labti/index.js
 */

const { join, sep } = require('path');
const dbsequel = require('sicinfo-dbsequel');

const dialect = 'mysql'
const schema = 'labti';

module.exports = options => {

  dialect in options || (options[dialect] = {});

  if (!(schema in options[dialect])) {

    const {
      database, username, password, 
      host = 'localhost', 
      port = '3306', 
      pool = {}, 
      define = {},
      prefixTableName = `${schema}_`
    } = require(join(process.env.HOME, options.dbconfig))[dialect][schema];

    'max' in pool || (pool.max = 5);
    'min' in pool || (pool.min = 0);
    'idle' in pool || (pool.idle = 10000);
    'acquire' in pool || (pool.acquire = 30000);

    'timestamps' in define || (define.timestamps = false);
    'underscored' in define || (define.underscored = false);
    'freezeTableName' in define || (define.freezeTableName = true);
    
    options[dialect][schema] = dbsequel({
      database, username, password, prefixTableName,
      'options': { pool, define, dialect, host, port },
      'dirmodels': __dirname
    })

  }

  return options[dialect][schema];
};
```

```
/***
 * application: labti
 * module: application/grupo.js
 * 
 * Powered [0.0.1] by Moreira in 2017-12-06
 * 
 */
'use strict';

const { join } = require('path');

module.exports = options => new Promise((resolve, reject) => {
  
  const model = require(join(options.dirname, 'models', 'mysql', 'labti'))(options)
  .then(ff => ff('Grupo'));
  
  resolve(({ req }) => {

    return model.then(({fetch}) => fetch(req));

  })

});
```

```
/**
 * application: labti
 * module: models/mysql/labti/xx-Grupo
 */

module.exports.schema = (Datatypes, done) => {

  return done({
    'nome': { 'type': Datatypes.STRING },
    'id': Datatypes.PRIMARYKEY
  })

};
```

```
/**
 * application labti
 * module: application/index.js
*/

const { join } = require('path');

module.exports = ({ dirname, version }) => {

  const { config } = require(join(dirname, 'package.json'));
  Object.assign(config, { dirname, version, 'mysql': {} });

  return name => {

    const _promise = require(`./${name}`)(config);

    return (req, res) => _promise
      .then(next => next.call(this, { req }))
      .then(resp => res.json(resp));

  };

};
```

```
/**
 * application: labti
 * module: index.js
 * 
 * Updated: 
 * [0.0.10] Moreira
 * - inclui verison
 * 
 * [0.0.1] Moreira 2017-11-08
 *
 ************************************************/

'use strict';

const express = require('express');
const { json } = require('body-parser');
const { join } = require('path');

const { version } = require(join(__dirname, '..', 'package.json'));
const application = require('./application')({'dirname': __dirname, version});

const app = module.exports = express();

app.get('/version', (req, res) => res.json({ version }))

app.get('/etiqueta(/:id)?', application('etiqueta'));

app.get('/grupo(/:id)?', application('grupo'));
```