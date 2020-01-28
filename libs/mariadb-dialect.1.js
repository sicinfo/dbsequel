/**
 * application: dbsequel
 * 
 * powered by Moreira in 2019-06-22
 */
const log = (a, ...b) => (({log}) => {
  log(a, __filename);
  for (const m of b) log(' -', m);
})(console);
log('loading...');

const 
  md5 = require('blueimp-md5'),
  { assign, keys } = Object,
  { isArray } = Array,
  // { newId } = require('sicinfo-idcreate'),
  { Model, DataTypes, fn, col, where, Op } = require('sequelize'),
  
  dialect =  'mariadb',
  dialectOptions = {
    'connectionTimeout': 1000,
    'timezone': 'Etc/GMT0' 
  },
  pool = { 'max': 5, 'min': 0, 'idle': 10000 };

class Document extends Model {
  
  static get isDocument() {
    return !('isRelationship' in this) || !this.isRelationship;
  }
  
  static get prefixTableName() {
    return  (a => a && (b => b && `${b}_`)(a.prefixTableName) || '')(this.sequelize.options.define);
  }
  
  static getTableName() {
    return `${this.prefixTableName}${super.getTableName().toLowerCase()}`;
  }
  
  static sync(options = {}) {
    
    const
      tableName = this.getTableName(),
      attrs = [
        '`rawdata` JSON NOT NULL UNIQUE CHECK (JSON_VALID(JSON_QUERY(`rawdata`, "$.*.*")))',
        '`version` INTEGER NOT NULL DEFAULT 0',
        '`createdAt` DATETIME NOT NULL',
        '`updatedAt` DATETIME NOT NULL',
        '`deletedAt` DATETIME',
        '`collsKey` CHAR(32) AS (MD5(JSON_UNQUOTE(JSON_EXTRACT(JSON_KEYS(`rawdata`), "$[0]")))) VIRTUAL', 'INDEX (`collsKey`)',
        '`doctKey` CHAR(32) AS (MD5(JSON_UNQUOTE(JSON_EXTRACT(JSON_KEYS(JSON_QUERY(`rawdata`, "$.*")), "$[0]")))) VIRTUAL', 'INDEX (`doctKey`)',
        '`fromId` CHAR(32) AS (JSON_VALUE(`rawdata`, "$.*.from")) VIRTUAL',
        '`toId` CHAR(32) AS (JSON_VALUE(`rawdata`, "$.*.to")) VIRTUAL', 
        '`id` CHAR(32) AS (MD5(CONCAT(`collsKey`, `doctKey`, IFNULL(`fromId`, ""), IFNULL(`toId`, ""), IFNULL(`deletedAt`, "")))) VIRTUAL UNIQUE CHECK (`id` IS NOT NULL)',
        `FOREIGN KEY (\`fromId\`) REFERENCES \`${tableName}\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT`,
        `FOREIGN KEY (\`toId\`) REFERENCES \`${tableName}\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT`
      ];
      
    const { sequelize } = this;
    sequelize.query(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (${attrs.join(',')}) ENGINE=InnoDB`);
  }

  static async init(attrs, opts = {}) {
    if (!opts.sequelize) throw 'No Sequelize instance';
    if (!attrs) attrs = {};
  
    if (!attrs.rawdata) attrs.rawdata = {
      'type': DataTypes.JSON,
      'allowNull': false
    };
    
    if (!attrs.id) attrs.id = {
      'type': DataTypes.CHAR(32),
      'primaryKey': true,
      'autoIncrement': true
    };
    
    await super.init(
      attrs,
      assign({ 'sequelize': opts.sequelize },
        ...['freezeTableName', 'timestamps', 'paranoid', 'version'].map(k => (o => (o[k] = undefined === opts[k] || opts[k], o))({})),
        ...['tableName'].filter(k => undefined !== opts[k]).map(k => (o => (o[k] = opts[k], o))({}))
      )
    );
  }

  static fetchAll(options) {
    options = assign({ 'raw': true }, options);
    return super.findAll(options);
  }
  
  static _fnJsonValueQuery(fnJson, arg, opts) {
    if (undefined == opts) [arg, opts] = ['rawdata', arg];
    if ('string' === typeof(arg)) arg = col(arg);
    opts = 'string' === typeof(opts) ? `$.${opts}` : fn('CONCAT', '$.', opts);
    return fn(fnJson, arg, opts);
  }
  
  static fnJsonQuery(...args) {
    return this._fnJsonValueQuery('JSON_QUERY', ...args);
  }
  
  static fnJsonValue(...args) {
    return this._fnJsonValueQuery('JSON_VALUE', ...args);
  }
  
  static fnJsonKeys(arg, opts) {
    if (undefined == opts) [arg, opts] = ['rawdata', arg];
    const keys = fn('JSON_KEYS', 'string' === typeof(arg) ? col(arg) : arg);
    return opts.unquote ? fn('JSON_UNQUOTE', fn('REGEXP_REPLACE', keys, '[[]|[]]', '')) : keys;
  }
  
  static patchCollection(values = {}, options = {}) {
    return new Promise((resolve, reject) => {
      
      const { collectionName } = this;
      if (undefined === collectionName || null == collectionName || '' === `${collectionName}`)
        throw { 'code': '403', 'message': `indefined or invalid collection name (${collectionName})` };

      Reflect.has(options, 'where') || 
      Reflect.set(options, 'where', {});
      Reflect.set(options.where, 'collsKey', md5(collectionName));

      const rawdata = fn('JSON_SET'
        , col('rawdata')
        , ...keys(values)
          .map(key => [`$.${collectionName}.${key}`, values[key]])
          .reduce((a, b) => a.concat(b))
        );

      super.update({ rawdata }, options)
        .then(([updated]) => {
          if (updated) resolve({ 'code': 204 });
          else reject({ 'code': 400, 'message': `unchanged collection (${collectionName}` });
        })
        .catch(error => {
          if (error.name && error.name.startsWith('Sequelize')) reject({
            'code': 409,
            'message': error.errors.map(arg => `${arg.type} in "${arg.instance.toString().split(':')[1].slice(0, -1)}"`).join(', ')
          });
          else reject(error);
        });
    });
  }
  
  static removeCollection(options = {}) {
    return new Promise((accept, reject) => {
      
      const { collectionName } = this;
      if (undefined === collectionName || null == collectionName || '' === `${collectionName}`)
        return reject({ 'code': '403', 'message': `indefined or invalid collection name (${collectionName})` });
        
      if (undefined === options.where) options.where = {};
      options.where.collsKey = md5(collectionName);
      
      super.destroy(options)
        .then(resp => {
          if (resp) accept({ 'code': 204 });
          else reject({ 'code': 400, 'message': `unremoved collection (${collectionName}` });
        })
        .catch(error => {
          if (error.name && error.name.startsWith('Sequelize')) reject({
            'code': 409,
            'message': error.errors.map(arg => `${arg.type} in "${arg.instance.toString().split(':')[1].slice(0, -1)}"`).join(', ')
          });
          else reject(error);
        });
    });
  }
  
  static fetchAllCollections(options = {}) {
    
    options = assign({ 'attributes': [], 'where': {} }, options);
    const { attributes, where } = options;

    const { collectionName, name } = this;
    
    attributes.push(
      (colName => [fn('JSON_QUERY', col(colName), '$.*'), colName])(`${name}.rawdata`),
      (colName => [col(colName), colName])(`${name}.id`)
    );
    
    where.collsKey = md5(collectionName);
    
    return this.fetchAll(options)
      .then(arg => {
        if (arg) return { 
          'result': options.plain ? 
            this._parse(arg, name) : 
            isArray(arg) ? arg.map(arg => this._parse(arg, name)) : arg 
        };
        else throw { 'code': 404, 'message': `${collectionName} not found (${arg})` };
      })
      .catch(error => {
        (console.warn)(101, __filename, error);
        return error;
      });
  }
  
  static fetchOneCollection(options = {}) {
    assign(options, { 'limit': 1, 'plain': true });
    return this.fetchAllCollections(options);
  }
  
  static jsonKeysToSql(col = '`rawdata`') {
    return `JSON_KEYS(${col})`;
  }
  
  static jsonQueryToSql(arg, col = '`rawdata`') {
    return `JSON_QUERY(${col}, CONCAT('$.', ${arg}))`;
  }
  
  static regexpReplaceToSql(arg) {
    return `JSON_UNQUOTE(REGEXP_REPLACE(${arg}, '[[]|[]]', ''))`;
  }
  
  static createCollection(values = {}, options = {}) {
    return new Promise((resolve, reject) => {
      const { collectionName } = this;
      
      if (undefined === collectionName || null == collectionName || !`${collectionName}`) 
        throw { 'code': '403', 'message': `indefined or invalid collection name (${collectionName})` };
        
      options = assign(rawdata => ({
        'defaults': { rawdata },
        'where': { 'rawdata': fn('JSON_UNQUOTE', JSON.stringify(rawdata)) },
        'raw': true,
        'plain': true,
        'paranoid': false,
        'attributes': ['id']
      }))((a => (a[collectionName] = values, a))({}), options);
      
      super.findOrCreate(options).then(([{ id }]) => {
        id ? reject({'code': 409, 'message': id }) :
        resolve(this.fetchAll(options).then(({ id }) => ({ 'result': { '_id': id } })));
      }).catch(({code = 500, message, name, errors }) => {
        (name && name.startsWith('Sequelize')) ?
        reject({ 
          'code': 409, 
          'message': (isArray(errors) ? errors : [errors]).map(arg => `${arg.type} in "${arg.instance.toString().split(':')[1].slice(0, -1)}"`).join(', ')
        }) : (
          [[148.0, __filename, code], [148.1, __filename, message]].forEach(msg => (console.warn)(...msg)),
          reject({ code, message })
        );
      });
    });
  }

  static createDocument(documentKey, values = {}, options) {
    if (undefined === documentKey || null == documentKey || '' === `${documentKey}`) {
      return Promise.reject({ 'code': '403', 'message': `invalid key (${documentKey})` });
    }
    
    return this.createCollection((data => (data[documentKey] = values, data))({}), options);
  }
  
  static patchDocument(documentKey, values = {}, options = {}) {
    return new Promise((resolve, reject) => {
      
      if (undefined === documentKey || null == documentKey || '' === `${documentKey}`)
        throw { 'code': '403', 'message': `invalid key (${documentKey})` };
        
      Reflect.has(options, 'where') || 
      Reflect.set(options, 'where', {});
      Reflect.set(options.where, 'doctKey', md5(documentKey));
      
      this.patchCollection(
        assign({}, ...keys(values).map(
          fieldName => (a => (a[`${documentKey}.${fieldName}`] = values[fieldName], a))({})
        )), options
      ).then(resolve).catch(error => {
        if (error.code == 400) error.message = `unchanged document (${documentKey})`;
        reject(error);
      });
    });
  }
  
  static removeDocument(documentKey, options = {}) {
    return new Promise((accept, reject) => {
      if (undefined === documentKey || null == documentKey || '' === `${documentKey}`)
        return reject({ 'code': '403', 'message': `invalid key (${documentKey})` });
        
      if (undefined === options.where) options.where = {};
      options.where.doctKey = md5(documentKey);
      
      this.removeCollection(options).then(accept).catch(error => {
        if (error.code == 400) error.message = `unchanged document (${documentKey})`;
        reject(error);
      });
    });
  }
  
  static fetchDocument(documentKey) {
    return this.fetchOneCollection({ 'where': { 'doctKey': md5(documentKey) } })
      .then(arg => (arg.result = arg.result[documentKey], arg));
    
  }
  
  static _parse(data, name) {
    if (!keys(data).some(field => name === field.split('.').slice(0, -1).join('.'))) return;

    const 
      _id = data[`${name}.id`],
      raw = _id && (raw => raw && JSON.parse(raw))(data[`${name}.rawdata`]),
      _key = raw && keys(raw)[0];
    if (!_key) return;

    return assign(
      raw[_key], { _id, _key },
      this.isRelationship ? ['from', 'to'].reduce((red, key) => {
        (val => val && (red[`_${key}`] = val))(raw[key]);
        return red;
      }, {}) : undefined);
  }
  
}

class Relationship extends Document {
  
  static get isRelationship() {
    return true;
  }
  
  static init(attrs, opts = {}) {
    if (!attrs) attrs = {};

    for (const elem of ['from', 'to']) (key => {
      if (!attrs[key]) attrs[key] = { 'type': DataTypes.CHAR(32) };
    })(`${elem}Id`);
    
    super.init(attrs, opts);
    
    ((opts, ...args) => args.forEach(model => {
      model.init(null, opts);
      this.belongsTo(model, { 'foreignKey': `${model.name.toLowerCase()}Id` });
    }))(
      {
        'sequelize': opts.sequelize, 
        'freezeTableName': true, 
        'tableName': opts.tableName 
      }, 
      class From extends Document {}, 
      class To extends Document {}
    );
  }
  
  static createDocument(documentKey, values = {}, from, to, options) {
    if (undefined === documentKey || null == documentKey || '' === `${documentKey}`) {
      return Promise.reject({ 'code': '403', 'message': `invalid key (${documentKey})` });
    }
    
    return this.createCollection(
      (data => (data[documentKey] = values, assign(data, { from, to })))({}),
      options
    );
  }

  static fetchAllCollections(options = {}) {
    
    options = assign({ 
      'include': [],
      'timestamps': false,
    }, options);

    this.From && options.include.push(Relationship._include(class From extends this.From {}));
    this.To && options.include.push(Relationship._include(class To extends this.To {}));

    return super.fetchAllCollections(options);
  }
  
  static _include(model, ...args) {
      return assign({
          model,
          required: false,
          paranoid: false,
          'attributes': [
            (colName => [col(colName), colName])('id'),
            (colName => (col => [fn('JSON_QUERY', col, '$.*'), colName])(
              col((a => `${a}.${colName}`)(args.reduce((r, a) => r.concat(a.name), [model.name]).reverse().join('->')))
            ))('rawdata')
              ]
        },
  
        model.isRelationship && ({
          'include': [
            model.From && class From extends model.From {},
            model.To && class To extends model.To {}
          ].filter(a => a).map(_model => Relationship._include(_model, model, ...args))
        })
      );
  }

  static _parse(data, name, _from = 'From', _to = 'To') {
log(389, data);    
    return (resp => (log)(388, resp) || resp && assign(resp,
        ...(([_from, _to]) => [_from && { _from }, _to && { _to }])
        ([_from, _to].map(name =>
          (model => model && model._parse(data, name, `${name}.From`, `${name}.To`))
          (this[name.split('.').slice(-1)[0]])
        ))
      ))
      (super._parse(data, name));
  }

}

module.exports = { pool, dialect, dialectOptions, Document, Relationship };
