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
  
  static fetchAll(opts = {}) {
    ((arg = [opts, 'raw', true]) => Reflect.has(...arg) || Reflect.set(...arg))();
    return this.findAll(opts);
  }
  
  static fetchAllCollections(options = {}) {
    
    const { name, collectionName } = this;

    Reflect.has(options, 'attributes') || 
    Reflect.set(options, 'attributes', []);
    
    
    for (const attrs of [
      `${name}.id`,
      [fn('JSON_UNQUOTE', fn('JSON_EXTRACT', col(`${name}.keydata`), '$[1]')), 'key'],
      `${name}.rawdata`
    ]) options.attributes.includes(attrs) || options.attributes.push(attrs);

    Reflect.has(options, 'where') ||
    Reflect.set(options, 'where', {});
    Reflect.set(options.where, 'collsKey', md5(collectionName));
    
    return this.fetchAll(options)
      .then(args => {
        args || errorsMsg('NotFound', collectionName, args);
        return { 
          'result': options.plain ? 
            this._parse(args, name) : 
            Array.isArray(args) ? args.map(arg => this._parse(arg, name)) : args 
        };
      })
      .catch(error => {
        (console.warn)(101, __filename, error);
        return error;
      });
  }
  
  static fetchDocumentById(id, opts = {}) {
    
    Reflect.set(opts, 'where', { id });
    Reflect.set(opts, 'plain', true);
    
    Reflect.has(opts, 'paranoid') ||
    Reflect.set(opts, 'paranoid', false);
    
    Reflect.has(opts, 'attributes') ||
    Reflect.set(opts, 'attributes', []);
    opts.attributes.includes('rawdata') ||
    opts.attributes.push('rawdata');
    
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
  
  static async init(attrs, opts = {}) {
    if (!opts.sequelize) throw 'No Sequelize instance';
    if (!attrs) attrs = {};
    
    for (const key of ['keydata', 'rawdata']) {
      Reflect.has(attrs, key) || 
      Reflect.set(attrs, key, {
        'type': DataTypes.JSON,
        'allowNull': false
      });
    }

    Reflect.has(attrs, 'id') ||
    Reflect.set(attrs, 'id', {
      'type': DataTypes.CHAR(32),
      'primaryKey': true,
      'autoIncrement': true
    });
    
    await super.init(
      attrs,
      Object.assign({ 'sequelize': opts.sequelize },
        ...['freezeTableName', 'timestamps', 'paranoid', 'version'].map(k => (o => (o[k] = undefined === opts[k] || opts[k], o))({})),
        ...['tableName'].filter(k => undefined !== opts[k]).map(k => (o => (o[k] = opts[k], o))({}))
      )
    );
  }

  static get isDocument() {
    return !('isRelationship' in this) || !this.isRelationship;
  }
  
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
    
    // keydata
    //["collection","document","from","to"]
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
        '`fromId` CHAR(32) AS (JSON_UNQUOTE(JSON_EXTRACT(`keydata`, "$[2]"))) VIRTUAL',
        '`toId` CHAR(32) AS (JSON_UNQUOTE(JSON_EXTRACT(`keydata`, "$[3]"))) VIRTUAL', 
        '`id` CHAR(32) AS (MD5(CONCAT(`collsKey`, `doctKey`, IFNULL(`fromId`, ""), IFNULL(`toId`, ""), IFNULL(`deletedAt`, "")))) VIRTUAL UNIQUE CHECK (`id` IS NOT NULL)',
        `FOREIGN KEY (\`fromId\`) REFERENCES \`${tableName}\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT`,
        `FOREIGN KEY (\`toId\`) REFERENCES \`${tableName}\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT`
      ];
      
    const { sequelize } = this;
    sequelize.query(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (${attrs.join(',')}) ENGINE=InnoDB`);
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
  
  static _parse(arg, name) {

log(342, this.name, name, arg);
    
    arg = Object.entries(arg).reduce((a, [k, v]) => (null == v || Reflect.set(a, k, v)) && a, {});
    const { rawdata, id, key } = arg;
    return rawdata ? Object.assign(rawdata, { '_id': id, '_key': key }) : arg;
  }
  
}

class Relationship extends Document {
  
  static get From() {}
  
  static get To() {}

  static createDocument(documentKey, fromId, toId, values = {}, options) {
    
log(348, this.name, documentKey, fromId, toId, values);    
    
    fromId && toId || errorsMsg('FromAndToRequired', this.name);
    return super.createDocument([documentKey, fromId, toId], values, options);
  }

  static fetchAllCollections(opts = {}) {
    
    Reflect.has(opts, 'attributes') || 
    Reflect.set(opts, 'attributes', []);
    
    Reflect.has(opts, 'include') || 
    Reflect.set(opts, 'include', []);
    
    Reflect.has(opts, 'timestamps') || 
    Reflect.set(opts, 'timestamps', false);

    const { include, attributes } = opts;

    this.From ?
      include.push(Relationship._include(class From extends this.From {})) :
      attributes.push('fromId');
      
    this.To ? 
      include.push(Relationship._include(class To extends this.To {})) :
      attributes.push('toId');
    
    return super.fetchAllCollections(opts);
  }
  
  static init(attrs, opts = {}) {
    if (!attrs) attrs = {};

    for (const elem of ['from', 'to']) ((key = `${elem}Id`)=> {
      Reflect.has(attrs, key) || 
      Reflect.set(attrs, key, { 'type': DataTypes.CHAR(32),  });
    })();
    
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
  
  static get isRelationship() {
    return true;
  }
  
  static _include(model, ...args) {
    
    return Object.assign(
      
      {
        model,
        required: false,
        paranoid: false,
        'attributes': (alias => [
          [col('id'), 'id'],
          [fn('JSON_UNQUOTE', fn('JSON_EXTRACT', col(`${alias}.keydata`), '$[1]')), 'key'],
          [col('rawdata'), 'rawdata']
        ])(args.reduce((r, a) => r.concat(a.name), [model.name]).reverse().join('->'))
      },

      model.isRelationship && ({
        'include': [
          model.From && class From extends model.From {},
          model.To && class To extends model.To {}
        ].filter(a => a).map(_model => Relationship._include(_model, model, ...args))
      })
      
    );
  }
  
  
//   static _include(model, ...args) {
//   // '`fromId` CHAR(32) AS (JSON_UNQUOTE(JSON_EXTRACT(`keydata`, "$[2]"))) VIRTUAL'
      
//     const alias = args.reduce((r, a) => r.concat(a.name), [model.name]).reverse().join('->');
//       // _col = name => col(`${alias}.${name}`);
//       // _col = name => col(`${name}`);
      
// log(399, alias);      
    
//     return Object.assign({
//         model,
//         required: false,
//         paranoid: false,
//         'attributes': [
//           (colName => [col(colName), colName])('id'),
//           [fn('JSON_UNQUOTE', fn('JSON_EXTRACT', col(`${alias}.keydata`), '$[1]')), 'key'],
//           (colName => [col(colName), colName])('rawdata')
//         ]
//       },

//       model.isRelationship && ({
//         'include': [
//           model.From && class From extends model.From {},
//           model.To && class To extends model.To {}
//         ].filter(a => a).map(_model => Relationship._include(_model, model, ...args))
//       })
//     );
//   }

  // static _include(model, ...args) {
  //     return Object.assign({
  //         model,
  //         required: false,
  //         paranoid: false,
  //         'attributes': [
  //           (colName => [col(colName), colName])('id'),
  //           // (colName => (col => [fn('JSON_QUERY', col, '$.*'), colName])(
  //           (colName => (col => [col, colName])(
  //             col((a => `${a}.${colName}`)(args.reduce((r, a) => r.concat(a.name), [model.name]).reverse().join('->')))
  //           ))('rawdata')
  //             ]
  //       },
  
  //       model.isRelationship && ({
  //         'include': [
  //           model.From && class From extends model.From {},
  //           model.To && class To extends model.To {}
  //         ].filter(a => a).map(_model => Relationship._include(_model, model, ...args))
  //       })
  //     );
  // }
  
  static _parse(data, name, _from = 'From', _to = 'To') {
    
    const rawdata = super._parse(data, name);
    
log(496, this.name, data, rawdata)    ;
    
    
    const vals = ['from', 'to'].map(arg => (key => 
        
        ((attr = `${arg}Id`) => Reflect.has(data, attr) && [key, Reflect.get(data, attr)])() ||

        ((args = {_from, _to}) => (name => /*log(479, name, arg, key) ||*/
          // (_data => log(480, key, name, _data) || Reflect.has(_data, 'rawdata') && [key, this._parse(_data, name, `${name}.From`, `${name}.To`)])
          (_data => /*log(480, _data) ||*/ Reflect.has(_data, 'rawdata') && [key, this._parse(_data, name)])
          (Object.keys(data)
            .filter(attr => attr.startsWith(`${name}.`))
            .map(attr => /*log(483, attr) || */[attr.replace(`${name}.`, ''), Reflect.get(data, attr)])
          .reduce((acc, [key, val]) => /*log(484, key, val) ||*/ Reflect.set(acc, key, 'rawdata' === key ? JSON.parse(val) : val) && acc, {}))
        )(Reflect.get(args, `_${arg}`)))()
      )(`_${arg}`));
      
log(508, this.name, rawdata, vals);

    for (const val of vals) {
log(511, val, ...val)      ;
      val && val[1] && Reflect.set(rawdata, ...val);
    }
    
    return rawdata;
  }

//   static _parse(data, name, _from = 'From', _to = 'To') {
//     return (rawdata => {

// // log(445, name, _from, _to, rawdata, data);    
    
    
//     // ['from', 'to'].forEach(key => ((attr, key) => {
//     //   Reflect.has(data, attr) && Reflect.set(data.rawdata, key, Reflect.get(data, attr));
//     // })(`${key}Id`, `_${key}`));
    
//     for (const val of ['from', 'to'].map(arg => (key => 
//       (attr => Reflect.has(data, attr) && [key, Reflect.get(data, attr)])(`${arg}Id`) ||
//       (args => (name => /*log(479, name, arg, key) ||*/
//         // (_data => log(480, key, name, _data) || Reflect.has(_data, 'rawdata') && [key, this._parse(_data, name, `${name}.From`, `${name}.To`)])
//         (_data => /*log(480, _data) ||*/ Reflect.has(_data, 'rawdata') && [key, this._parse(_data, name)])
//         (Object.keys(data)
//           .filter(attr => attr.startsWith(`${name}.`))
//           .map(attr => /*log(483, attr) || */[attr.replace(`${name}.`, ''), Reflect.get(data, attr)])
//         .reduce((acc, [key, val]) => /*log(484, key, val) ||*/ Reflect.set(acc, key, 'rawdata' === key ? JSON.parse(val) : val) && acc, {}))
//       )(Reflect.get(args, `_${arg}`)))({_from, _to})
//     )(`_${arg}`))) /*log(486, val) ||*/ val && (([key, val]) => val && Reflect.set(rawdata, key, val))(val);


//   // log(490, rawdata);    
//       return rawdata;
//     })(super._parse(data, name));
    
    
    
//     // )) ((attr, key) => {
//     //   Reflect.has(data, attr) && Reflect.set(data.rawdata, key, Reflect.get(data, attr)) ||
//     //   (name => 
//     //     (_data => Reflect.has(_data, 'rawdata') && this._parse(_data, name, `${name}.From`, `${name}.To`))
//     //     (Object.keys(data)
//     //       .filter(attr => attr.startsWith(`${name}.`))
//     //       .map(attr => [attr.split(`${name}.`)[1], Reflect.get(data, attr)])
//     //     .reduce((acc, [key, val]) => Reflect.set(acc, key, 'rawdata' === key ? JSON.parse(val) : val) && acc, {}))
      
      
      
      
      
//     //   )(Reflect.get({_from, _to}, key))
      
      
      
//     // })(`${key}Id`, `_${key}`))
    
    
    
    
    
    
//     // [_from, _to].map(name => (_data => Reflect.has(_data, 'rawdata') && this._parse(_data, name, `${name}.From`, `${name}.To`))
//     //   (Object.keys(data)
//     //   .filter(attr => attr.startsWith(`${name}.`))
//     //   .map(attr => [attr.split(`${name}.`)[1], Reflect.get(data, attr)])
//     //   .reduce((acc, [key, val]) => Reflect.set(acc, key, 'rawdata' === key ? JSON.parse(val) : val) && acc, {})));
    
//     // _from && 
      
      
        

        
        
        
// //       })
        
        
        
// //         Reflect.has(data, `${name}.rawdata`) && 
        
// //         Reflect.set(data.rawdata, `${name}.rawdata`) && 
        
        
        
// //       }
        
        
        
        
        
// //       }
// //         Reflect.has(data, key) &&
// //         (Reflect.has(data.rawdata, name) || Reflect.set(data.rawdata, name, {})) &&
// //         Reflect.set(Reflect.get(data.rawdata, name), attr, Reflect.get(data, key))
// //       )(`${name}.${attr}`)));
        
      
      
// // log(464, name, _from, _to, data); 
      
      
      
      
      
      
//       // log(452, name, name.split('.').slice(-1)[0], this[name.split('.').slice(-1)[0]]) ||
//       //   (model =>  log(453, model) || model && model._parse(data, name, `${name}.From`, `${name}.To`))
//       //   (this[name.split('.').slice(-1)[0]])
//       // ))
//     // );

//     // return Object.assign(data.rawdata);





//     // return (data => log(450, data) || Object.assign(data,
//     //   ...(([_from, _to]) => [_from && { _from }, _to && { _to }])
//     //   ([_from, _to].map(name => log(452, name) ||
//     //     (model =>  log(453, model) || model && model._parse(data, name, `${name}.From`, `${name}.To`))
//     //     (this[name.split('.').slice(-1)[0]])
//     //   ))
//     // ))((rawdata => 
//     //   Object.assign(rawdata (_from => _from && { _from })(data.fromId), (_to => _to && { _to })(data.toId)) &&
//     //   Reflect.set(data)
//     // )(super._parse(data, name)));
//   }

//   static _parse(data, name, _from = 'From', _to = 'To') {
    
// log(459, name, data);    
    
//     return Object.assign(
//       super._parse(data, name),
//       (_from => _from && { _from })(data.fromId),
//       (_to => _to && { _to })(data.toId)
//     );
//   }

}

module.exports = { pool, dialect, dialectOptions, Document, Relationship };