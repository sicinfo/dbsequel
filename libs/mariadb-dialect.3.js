/**
 * application: dbsequel
 * server-side
 * 
 * powered by Moreira in 2019-06-22
 */
const log = (a, ...b) => (({log}) => {
  log(a, __filename);
  for (const m of b) log(' -', m);
})(console);
log('loading...');

const 

  multi = class {

    static inherit(..._bases) {
      
      class classes {
        constructor(..._args) {
          let index = 0;
          for (const b of this.base) multi.copy(this, new b(_args[index++]));
        }
        get base() { return _bases; }
      }

      for (let base of _bases) {
        multi.copy(classes, base);
        multi.copy(classes.prototype, base.prototype);
      }

      return classes;
    }

    static copy(_target, _source) {
      for (const key of Reflect.ownKeys(_source))
        key !== "constructor" &&
        key !== "prototype" &&
        key !== "name" &&
        Object.defineProperty(_target, key, Object.getOwnPropertyDescriptor(_source, key));
    }
    
  },
  
  uniqueId = function* (prefix = '_', _count = 0) {
    while (true) yield `${prefix}${(_count++).toString(36).padStart(3, '0')}`;
  },

  md5 = require('blueimp-md5'),
  { Model, DataTypes, fn, col, where, Op } = require('sequelize'),
  
  dialect =  'mariadb',
  dialectOptions = {
    'connectionTimeout': 1000,
    'timezone': 'Etc/GMT0' 
  },
  pool = { 'max': 5, 'min': 0, 'idle': 10000 },
  
  errorsMsg = (a, ...b) => (msg => {
    throw (([code, message]) => ({ code, message }))(msg[a](...b));
  })({
    'collectionName': () => [400, 'collection name not defined!'],
    'ConflitId': (b, c) => [409, `${a}: id "${c}" already exists to "${b}"`],
    'conflit': (a, b) => [409, a],
    'documentKey': a => [400, `invalid document key from ${a}`],
    'DocumentKeyRequired': (b) => [412, `${a}: Document Key is required to ${b}`],
    'FromAndToRequired': (b) => [412, `${a}: From and To is required to ${b}`],
    'NotFound': (a, b) => [404, ((a, b) => `${a}not found${b}`)(a && `{${a} ` || '', b && ` ({${b})` || '')],
    'NotFoundById': (a) => [404, `(${a}) - not found!`],
    'unchanged': (a, b) => [409, (b => `unchanged ${a}`)(b && ` (${b})` || '')],
    'unremoved': (a, b) => (b => `unremoved ${a}`)(b && ` (${b})` || '')
  });

class Document extends Model {
  
  // keydata: quando for aresta dever ser um array com
  // doctKey, fromId, toId
  // exemple.createDocument([doctKey, fromIf, toId], rawdata, opts)
  static createDocument(keydata, rawdata = {}, opts) {
    
    Array.isArray(keydata) || (keydata = [keydata]);
    keydata[0] || errorsMsg('DocumentKeyRequired', this.name);
    keydata.unshift(this.collectionName);

    opts = Object.assign({}, opts, {
      'defaults': { keydata, rawdata },
      'where': where(col('keydata'), Op.eq, fn('JSON_UNQUOTE', JSON.stringify(keydata))),
      'raw': true,
      'plain': true,
      'paranoid': false,
      'attributes': ['id']
    });
    
    return super.findOrCreate(opts)
      .then(([{ id }, created]) =>
        !created && errorsMsg('ConflitId', this.name, id) ||
        this.fetchAll(opts).then(({ id }) => ({ 'result': { '_id': id } }))
      );
  }
  
  static get collectionName() {
    return this.name.toLowerCase();
  }
  
  static attributes(name) {
    return [
      'id',
      'rawdata',
      [fn('JSON_UNQUOTE', fn('JSON_EXTRACT', col(`${name}.keydata`), '$[1]')), 'key']
    ];
  }
  
  static fetchAll(opts = {}) {
    ((arg = [opts, 'raw', true]) => Reflect.has(...arg) || Reflect.set(...arg))();
    return this.findAll(opts);
  }
  
//   static fetchAllCollections(opts = {}) {

//     Reflect.set(opts, 'hasAttributes', Reflect.has(opts, 'attributes'));

//     opts.hasAttributes || 
//     (Reflect.has(opts, 'attributes') || Reflect.set(opts, 'attributes', [])) &&
//     opts.attributes.push(...this.attributes(this.name));
    
//     Reflect.has(opts, 'include') || Reflect.set(opts, 'include', []);
//     Reflect.has(opts, 'timestamps') || Reflect.set(opts, 'timestamps', false);

//     this.From ?
//       opts.include.push(Relationship._include(opts.hasAttributes, this.From)):
//       opts.hasAttributes || opts.attributes.push('fromId');
      
//     this.To ? 
//       opts.include.push(Relationship._include(opts.hasAttributes, this.To)) :
//       opts.hasAttributes || opts.attributes.push('toId');

//     return super.fetchAllCollections(opts);
//   }


  static fetchAllCollections(opts = {}) {
    
    const 
      { name, collectionName } = this,
      hasAttributes = Reflect.has(opts, 'attributes');
      
    hasAttributes ||
    (Reflect.has(opts, 'attributes') || Reflect.set(opts, 'attributes', [])) &&
    opts.attributes.push(...this.attributes(name));
    
    Reflect.has(opts, 'where') || Reflect.set(opts, 'where', {});
    Reflect.set(opts.where, Op.and, where(col(`${name}.collsKey`), Op.eq, md5(collectionName)));
    
    for (const key of ['Inherit', 'From', 'To']) {
      !Reflect.get(this, `has${key}`) ||
      ((val = Reflect.get(this, key)) => 
        val && (Reflect.has(opts, 'include') || Reflect.set(opts, 'include', [])) &&
        opts.include.push(Document._include(hasAttributes, val))
      )() || hasAttributes || opts.attributes.push(`${key.toLowerCase()}Id`);
    }

    return this.fetchAll(opts)
      .then(resp =>
        !resp ? errorsMsg('NotFound', collectionName, resp) :
        opts.plain ? this._parse(resp, name) :
        Array.isArray(resp) ? resp.map(arg => this._parse(arg, name)) : resp
      )
      .then(result => ({ result }))
      .catch(error => (console.warn)(101, __filename, error) || error);
  }
  
  static fetchDocumentById(id, opts = {}) {
    
    Reflect.set(opts, 'where', { id });
    Reflect.set(opts, 'limit', 1);
    Reflect.set(opts, 'plain', true);
    
    Reflect.has(opts, 'paranoid') ||
    Reflect.set(opts, 'paranoid', false);
    
    Reflect.has(opts, 'attributes') || 
    Reflect.set(opts, 'attributes', []) &&
    opts.attributes.push(...this.attributes(this.name));

    return this.fetchAll(opts)
      .then(resp => 
        (resp || errorsMsg('NotFoundById', this.collectionName, id)) &&
        this._parse(resp, this.name)
      );
  }
  
  static fetchDocument(documentKey) {
    
    documentKey || errorsMsg('documentKey');
    
    return this.fetchOneCollection(
      { 'where': { 'doctKey': md5(documentKey) } }
    ).then(arg => (arg.result = arg.result[documentKey], arg));
    
  }
  
  static fetchOneCollection(options = {}) {
    Object.assign(options, { 'limit': 1, 'plain': true });
    return this.fetchAllCollections(options);
  }
  
  static fnJsonExtract(arg0, arg1) {
    return fn('JSON_UNQUOTE', fn('JSON_EXTRACT', col(arg0), arg1));
  }

  static fnJsonExtractTo(arg0, arg1, arg2) {
    return [this.fnJsonExtract(arg0, arg1), arg2];
  }
  
  static fnJsonKeys(arg, opts) {
    if (undefined == opts) [arg, opts] = ['rawdata', arg];
    const keys = fn('JSON_KEYS', 'string' === typeof(arg) ? col(arg) : arg);
    return opts.unquote ? fn('JSON_UNQUOTE', fn('REGEXP_REPLACE', keys, '[[]|[]]', '')) : keys;
  }
  
  static fnJsonQuery(...args) {
    return this._fnJsonValueQuery('JSON_QUERY', ...args);
  }
  
  static fnJsonValue(...args) {
    return this._fnJsonValueQuery('JSON_VALUE', ...args);
  }
  
  static jsonKeysToSql(col = '`rawdata`') {
    return `JSON_KEYS(${col})`;
  }
  
  static jsonQueryToSql(arg, col = '`rawdata`') {
    return `JSON_QUERY(${col}, CONCAT('$.', ${arg}))`;
  }
  
  static getTableName() {
    return `${this.prefixTableName}${super.getTableName().toLowerCase()}`;
  }
  
  static get hasInherit() {
    return Reflect.has(this, 'Inherit');
  }
  
  static get hasFrom() {
    return Reflect.has(this, 'From');
  }
  
  static get hasTo() {
    return Reflect.has(this, 'To');
  }
  
  static init(attrs = {}, opts = {}) {
    
    this.hasInherit && Reflect.set(attrs, `inheritId`, DataTypes.CHAR(32));
    this.hasFrom && Reflect.set(attrs, `fromId`, DataTypes.CHAR(32));
    this.hasTo && Reflect.set(attrs, `toId`, DataTypes.CHAR(32));

    for (const key of ['keydata', 'rawdata']) {
      Reflect.has(attrs, key) || Reflect.set(attrs, key, {
        'type': DataTypes.JSON,
        'allowNull': false
      });
    }
    
    Reflect.has(attrs, 'id') || Reflect.set(attrs, 'id', {
      'type': DataTypes.CHAR(32),
      'primaryKey': true,
      'autoIncrement': true
    });
    
    Reflect.has(opts, 'freezeTableName') || Reflect.set(opts, 'freezeTableName', true);
    Reflect.has(opts, 'timestamps') || Reflect.set(opts, 'timestamps', true);
    Reflect.has(opts, 'paranoid') || Reflect.set(opts, 'paranoid', true);
    Reflect.has(opts, 'version') || Reflect.set(opts, 'version', true);

    super.init(attrs, opts);
    
    this.hasInherit && this.Inherit && this.belongsTo(this.Inherit, { 'foreignKey': `inheritId` });
    this.hasFrom && this.From && this.belongsTo(this.From, { 'foreignKey': `fromId` });
    this.hasTo && this.To && this.belongsTo(this.To, { 'foreignKey': `toId` });

  }

  // static get isDocument() {
  //   return !('isRelationship' in this) || !this.isRelationship;
  // }
  
  static patchDocument(id, values = {}, options = {}) {
    return new Promise((resolve, reject) => {
      
      Reflect.set(options, 'where', where(col('id'), Op.eq, id));
      
      const rawdata = (values => fn('JSON_COMPACT', fn('JSON_MERGE_PATCH', col(`rawdata`), fn('JSON_OBJECT', ...values))))
        (Object.entries(values).reduce((acc, [key, val]) => acc.concat(`${key}`).concat(val), []));

      super.update({ rawdata }, options)
        .then(([updated]) => {
          if (updated) resolve({ 'code': 204 });
          else reject({ 'code': 400, 'message': `unchanged collection id (${id}` });
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
  
  static get prefixTableName() {
    return  (a => a && (b => b && `${b}_`)(a.prefixTableName) || '')(this.sequelize.options.define);
  }
  
  static regexpReplaceToSql(arg) {
    return `JSON_UNQUOTE(REGEXP_REPLACE(${arg}, '[[]|[]]', ''))`;
  }
  
  static removeCollection(options = {}) {
    
    Reflect.has(options, 'where') || 
    Reflect.set(options, 'where', {});
    
    const { collectionName } = this;
    
    Reflect.set(options.where, 'collsKey', md5(collectionName));

    return super.destroy(options)
      .then(resp => resp ? { 'code': 204 } : errorsMsg('unremoved', 'collection', collectionName))
      .catch(error => (error.name && error.name.startsWith('Sequelize')) ?
        errorsMsg('unremoved', 'collection', error.errors.map(arg => `${arg.type} in "${arg.instance.toString().split(':')[1].slice(0, -1)}"`).join(', ')) : 
        error
      );
  }
  
  static removeDocument(documentKey, options = {}) {
    
    documentKey || 
    errorsMsg('documentKey');
    
    Reflect.has(options, 'where') || 
    Reflect.set(options, 'where', {});
    
    Reflect.set(options.where, 'doctKey', md5(documentKey));
    
    return this.removeCollection(options)
      .catch(error => 
        error.code == 400 &&
        errorsMsg(409)('unchanged', 'document', documentKey) ||
        error
      );
  }
  
  static startTransaction() {
    return this.sequelize.transaction;
  }
  
  static sync(options = {}) {
    
    const
      tableName = this.getTableName(),
      attrs = [
        '`keydata` JSON NOT NULL UNIQUE CHECK (JSON_VALID(`keydata`))',
        '`rawdata` JSON NOT NULL CHECK (JSON_VALID(`rawdata`))',
        '`version` INTEGER NOT NULL DEFAULT 0',
        '`createdAt` DATETIME NOT NULL',
        '`updatedAt` DATETIME NOT NULL',
        '`deletedAt` DATETIME',
        '`collsKey` CHAR(32) AS (MD5(JSON_UNQUOTE(JSON_EXTRACT(`keydata`, "$[0]")))) VIRTUAL', 'INDEX (`collsKey`)',
        '`doctKey` CHAR(32) AS (MD5(JSON_UNQUOTE(JSON_EXTRACT(`keydata`, "$[1]")))) VIRTUAL', 'INDEX (`doctKey`)',
        '`inheritId` CHAR(32) AS (SUBSTRING(JSON_UNQUOTE(JSON_EXTRACT(`keydata`, "$[1]")), 1, 32)) VIRTUAL', 'INDEX (`inheritId`)',
        '`fromId` CHAR(32) AS (JSON_UNQUOTE(JSON_EXTRACT(`keydata`, "$[2]"))) VIRTUAL',
        '`toId` CHAR(32) AS (JSON_UNQUOTE(JSON_EXTRACT(`keydata`, "$[3]"))) VIRTUAL', 
        '`id` CHAR(32) AS (MD5(CONCAT(`collsKey`, `doctKey`, IFNULL(`fromId`, ""), IFNULL(`toId`, ""), IFNULL(`deletedAt`, "")))) VIRTUAL UNIQUE CHECK (`id` IS NOT NULL)',
        `FOREIGN KEY (\`fromId\`) REFERENCES \`${tableName}\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT`,
        `FOREIGN KEY (\`toId\`) REFERENCES \`${tableName}\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT`
      ];
      
    return this.sequelize.query(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (${attrs.join(',')}) ENGINE=InnoDB`);
  }

  // static patchCollection(values = {}, options = {}) {
  //   return new Promise((resolve, reject) => {
      
  //     const { collectionName } = this;
  //     if (undefined === collectionName || null == collectionName || '' === `${collectionName}`)
  //       throw { 'code': '403', 'message': `indefined or invalid collection name (${collectionName})` };

  //     Reflect.has(options, 'where') || 
  //     Reflect.set(options, 'where', {});
  //     Reflect.set(options.where, 'collsKey', md5(collectionName));

  //     const rawdata = fn('JSON_SET'
  //       , col('rawdata')
  //       , ...keys(values)
  //         .map(key => [`$.${collectionName}.${key}`, values[key]])
  //         .reduce((a, b) => a.concat(b))
  //       );

  //     super.update({ rawdata }, options)
  //       .then(([updated]) => {
  //         if (updated) resolve({ 'code': 204 });
  //         else reject({ 'code': 400, 'message': `unchanged collection (${collectionName}` });
  //       })
  //       .catch(error => {
  //         if (error.name && error.name.startsWith('Sequelize')) reject({
  //           'code': 409,
  //           'message': error.errors.map(arg => `${arg.type} in "${arg.instance.toString().split(':')[1].slice(0, -1)}"`).join(', ')
  //         });
  //         else reject(error);
  //       });
  //   });
  // }
  
  static _fnJsonValueQuery(fnJson, arg, opts) {
    if (undefined == opts) [arg, opts] = ['rawdata', arg];
    if ('string' === typeof(arg)) arg = col(arg);
    opts = 'string' === typeof(opts) ? `$.${opts}` : fn('CONCAT', '$.', opts);
    return fn(fnJson, arg, opts);
  }
  
  static _include(hasAttributes, model, ...args) {
    
    const opts = { model, 'required': false, 'paranoid': false, 'include': [] };
    
    hasAttributes || 
    Reflect.set(opts, 'attributes', this.attributes(args.reduce(
      (acc, { options }) => acc.concat(options.name.singular),
      [model.options.name.singular]
    ).reverse().join('->')));
    
    for (const _model of [this.Inherit, this.From, this.To]) {
      _model && opts.include.push(Document._include(hasAttributes, _model, model, ...args));
    }
    
    return opts;
  }
  
  static _parse(resp, name) {
    
    return resp.rawdata ?
      (({ rawdata, id, key } = resp) => Object.assign(rawdata, { '_id': id, '_key': key }))() :
      Object.entries(resp).reduce((a, [k, v]) => (null == v || Reflect.set(a, k, v)) && a, {});
      
  }
  
}

// class Relationship extends Document {

//   static get From() {}
  
//   static get To() {}
  
//   static createDocument(documentKey, fromId, toId, values = {}, options) {
//     fromId && toId || errorsMsg('FromAndToRequired', this.name);
//     return super.createDocument([documentKey, fromId, toId], values, options);
//   }

//   static fetchAllCollections(opts = {}) {

//     Reflect.set(opts, 'hasAttributes', Reflect.has(opts, 'attributes'));

//     opts.hasAttributes || 
//     (Reflect.has(opts, 'attributes') || Reflect.set(opts, 'attributes', [])) &&
//     opts.attributes.push(...this.attributes(this.name));
    
//     Reflect.has(opts, 'include') || Reflect.set(opts, 'include', []);
//     Reflect.has(opts, 'timestamps') || Reflect.set(opts, 'timestamps', false);

//     this.From ?
//       opts.include.push(Relationship._include(opts.hasAttributes, this.From)):
//       opts.hasAttributes || opts.attributes.push('fromId');
      
//     this.To ? 
//       opts.include.push(Relationship._include(opts.hasAttributes, this.To)) :
//       opts.hasAttributes || opts.attributes.push('toId');

//     return super.fetchAllCollections(opts);
//   }
  
//   static init(attrs = {}, opts = {}) {

//     Reflect.set(attrs, `fromId`, DataTypes.CHAR(32));
//     Reflect.set(attrs, `toId`, DataTypes.CHAR(32));
    
//     super.init(attrs, opts);
    
//     this.From && this.belongsTo(this.From, { 'foreignKey': `fromId` });
//     this.To && this.belongsTo(this.To, { 'foreignKey': `toId` });
//   }
  
//   static get isRelationship() {
//     return true;
//   }
  
//   static _include(hasAttributes, model, ...args) {
    
//     const opts = { model, required: false, paranoid: false };
    
//     hasAttributes || 
//     Reflect.set(opts, 'attributes', this.attributes(args.reduce(
//       (acc, { options }) => acc.concat(options.name.singular),
//       [model.options.name.singular]
//     ).reverse().join('->')));
    
//     model.isRelationship && Reflect.set(opts, 'include', [model.From, model.To].filter(a => a).map(
//       _model => Relationship._include(hasAttributes, _model, model, ...args)
//     ));
    
//     return opts;
//   }

//   static _parse(data, name, _from = 'From', _to = 'To') {
    
//     const 
//       rawdata = super._parse(data, name),
//       vals = [];
      
//     for (const arg of ['from', 'to']) {
//       const key = `_${arg}`;
      
//       {
//         const attr = `${arg}Id`;
//         if (Reflect.has(data, attr)) {
//           vals.push([key, Reflect.get(data, attr)]);
//           continue;
//         }
//       }
      
//       const 
//         name = Reflect.get({ _from, _to }, `_${arg}`),
//         _name = `${name}.`,
//         _data = Object.entries(data)
//           .filter(([key, val]) => key.startsWith(_name))
//           .map(([key, val]) => [key.replace(_name, ''), val])
//           .reduce((acc, [key, val]) => Reflect.set(acc, key, 'rawdata' === key ? JSON.parse(val) : val) && acc, {});
      
//       Reflect.has(_data, 'rawdata') &&
//       vals.push([key, this._parse(_data, name)]);
//     }
    
//     for (const args of vals) Reflect.set(rawdata, ...args);
    
//     return rawdata;
//   }

// }

module.exports = { 
  pool, 
  dialect, 
  dialectOptions, 
  uniqueId, 
  Document
  // Relationship, 
};