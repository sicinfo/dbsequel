# DbSequel

### mysql
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
### postgres
```
/**
 * application: labti-server
 * module: models/postgres/citsmart/index.js
 */

const { join, sep } = require('path');
const dbsequel = require('sicinfo-dbsequel');

const dialect = 'postgres';
const schema = 'citsmart';

module.exports = options => {

  dialect in options || (options[dialect] = {});

  if (!(schema in options[dialect])) {

    const {
      database, username, password, 
      host = 'localhost', 
      port = '5432', 
      pool = {}
    } = require(join(process.env.HOME, options.dbconfig))[dialect][schema];

    'max' in pool || (pool.max = 5);
    'min' in pool || (pool.min = 0);
    'idle' in pool || (pool.idle = 10000);
    'acquire' in pool || (pool.acquire = 30000);

    options[dialect][schema] = dbsequel({
      database, username, password,
      'options': { pool, dialect, host, port },
      'dirmodels': __dirname
    })

  }

  return options[dialect][schema];
};
```

### apllication/grupo
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
  
  resolve(opts => {

    return model.then(({fetch}) => fetch(opts));

  })

});
```


### schema para grupo
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

### application/index
```
/**
 * application labti
 * module: application/index.js
*/

const { join } = require('path');

module.exports = ({ dirname, version }) => {

  const { config } = require(join(dirname, 'package.json'));
  Object.assign(config, { dirname, version, 'mysql': {}, 'postgres': {} });

  return (name, promise) => {

    return ({ query, params, method }, res) => {

      promise || (promise = require(`./${name}`)(config))

      return promise
        .then(next => {

          const opts = { 'where': query, method };

          Object.keys(params)
            .filter(k => undefined !== params[k] && isNaN(k))
            .forEach(k => opts[k] = params[k]);

          return next.call(this, opts)
        })
        .then(resp => {
          
          if (resp.count) {
            res.append('X-total-count', resp.count);
          }

          return res.json(resp.rows);
        })
        .catch(error => {
          return res.status(404).json({error})
        });
    }
  };

};
```

### index
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

app.get('/solicitacaoservico/:idsolicitacaoservico', application('solicitacaoservico'));

```