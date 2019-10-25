/**
 * application: dbsequel
 * 
 * powered by Moreira in 2019-06-22
 */
const log = (a, ...b) => console.log(a, __filename, ...b);
log('loading...');

const 
  md5 = require('blueimp-md5'),
  { newId } = require('sicinfo-idcreate'),
  { Model, DataTypes, fn, col } = require('sequelize');
  
module.exports = class AbstractModel extends Model {
  
  static getPrefixTableName() {
    return  (a => a && (b => b && `${b}_`)(a.prefixTableName) || '')(this.sequelize.options.define);
  }
  
  static getTableName() {
    return `${this.getPrefixTableName()}${super.getTableName().toLowerCase()}`;
  }
  
  static fnJsonQuery(arg, opts) {
    if (!opts)[arg, opts] = ['memo', arg];
    if ('string' === typeof(arg)) arg = col(arg);
    opts = 'string' === typeof(opts) ? `$.${opts}` : fn('CONCAT', '$.', opts);
    return fn('JSON_QUERY', arg, opts);
  }
  
  static fnJsonValue(arg, opts) {
    if (!opts)[arg, opts] = ['memo', arg];
    if ('string' === typeof(arg)) arg = col(arg);
    opts = 'string' === typeof(opts) ? `$.${opts}` : fn('CONCAT', '$.', opts);
    return fn('JSON_VALUE', arg, opts);
  }
  
  static fnJsonKeys(arg, opts) {
    if (!opts) [arg, opts] = ['memo', arg || {}];
    const keys = fn('JSON_KEYS', 'string' === typeof(arg) ? col(arg) : arg);
    return opts.unquote ? fn('JSON_UNQUOTE', fn('REGEXP_REPLACE', keys, '[[]|[]]', '')) : keys;
  }

  static createCollection(collectionName, values, options = {}) {
    values = { 'memo': (a => (a[collectionName] = values || {}, a))({}) };
    if (options.values) {
      Object.assign(values, options.values);
      delete options.values;
    }
    
    return new Promise((accept, reject) => {
      super.create(values, options)
        .then(result => {
          if (result && result.dataValues) {
            result = (a => (b => (c => c)(b[collectionName]) || b)(a.memo) || a)(result.dataValues);
            accept({ result });
          }
          else {
            reject({ 'code': 409, 'message': `${result}` });
          }
        })
        .catch(error => {
          if (error.name && error.name.startsWith('Sequelize')) reject({
            'code': 409,
            'message': error.errors.map(arg => `${arg.type} in "${arg.instance.toString().split(':')[1].slice(0, -1)}"`).join(', ')
          });
          else {
            Object.keys(error).forEach((key, ind) => log(`68-${ind}`, key, error[key]));
            reject(error);
          }
        });
      
    });
  }
  
  static fetchAllCollection(collectionName, options = {}) {
    options = Object.assign({
        'attributes': [],
        'where': {},
        'raw': true
      }, options);
      
    if (!Object.keys(options.attributes).some(key => Array.isArray(key) && key.includes(collectionName))) 
      options.attributes.push([this.fnJsonQuery(collectionName), collectionName]);
                
    options.where.colls = md5(collectionName);
    
    return new Promise((accept, reject) => {
      this.findAll(options)
        .then(result => {
          if (result) {
            accept({ 'result': result[collectionName] && JSON.parse(result[collectionName]) || result });
          }
          else {
            reject({ 'code': 404, 'message': `${collectionName} not found (${result})` });
          }
        })
        .catch(error => {
          log(101, error);          
          reject(error);
        });
    });
  }
  
  static fetchOneCollection(collectionName, options = {}) {
    Object.assign(options, { 'limit': 1, 'plain': true });
    return this.fetchAllCollection(collectionName, options);
  }
  
  static jsonKeysToSql(col = '`memo`') {
    return `JSON_KEYS(${col})`;
  }
  
  static jsonQueryToSql(arg, col = '`memo`') {
    return `JSON_QUERY(${col}, CONCAT('$.', ${arg}))`;
  }
  
  static regexpReplaceToSql(arg) {
    return `JSON_UNQUOTE(REGEXP_REPLACE(${arg}, '[[]|[]]', ''))`;
  }
  
  // create table to mariadb dialect
  static sync(attrs = [], options = {}) {
    
    const
      tableName = this.getTableName(),
      _attrs = [`\`_key\` CHAR(10) KEY`].concat(
        ...attrs.filter(attr => attr.startsWith('_')),
        '`version` INTEGER NOT NULL DEFAULT 0',
        '`createdAt` DATETIME NOT NULL',
        '`updatedAt` DATETIME NOT NULL',
        '`deletedAt` DATETIME',
        '`memo` JSON NOT NULL CHECK (JSON_VALID(`memo`))',
        `\`colls\` CHAR(32) AS (MD5(${this.regexpReplaceToSql(this.jsonKeysToSql())})) VIRTUAL`,
        'INDEX (`colls`)',
        ...attrs.filter(attr => !attr.startsWith('_'))
      );
      
    const { sequelize } = this

    return sequelize.query(
      `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${_attrs.join(',')}) ENGINE=InnoDB`
    ).then(resp => Object.assign({ 'models': sequelize.models }, resp));
  }

  static init(attrs, opts = {}) {
    if (!opts.sequelize) throw new Error('No Sequelize instance');

    super.init(
      
      Object.assign({
        'colls': DataTypes.VIRTUAL,
        'memo': {
          'type': DataTypes.JSON,
          'defaultValue': '{}',
          'allowNull': false
        },
        '_key': {
          'type': DataTypes.CHAR(10),
          'defaultValue': () => newId().toLowerCase(),
          'primaryKey': true
        }
      }, attrs), 
      
      Object.assign(
        { 'sequelize': opts.sequelize },
        ...['freezeTableName', 'timestamps', 'paranoid', 'version'].map(k => (o => (o[k] = undefined === opts[k] || opts[k], o))({})),
        ...['tableName'].filter(k => undefined !== opts[k]).map(k => (o => (o[k] = opts[k], o))({}))
      )
    );
  }

};