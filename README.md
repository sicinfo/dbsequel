# DbSequel

/**
 * application labti-portal
 */

const { join, sep } = require('path');
const dbsequel = require('dbsequel');

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
