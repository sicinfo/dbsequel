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
    return (([code, message]) => ({ code, message }))(msg[a](...b));
  })({
    'collectionName': () => [400, 'collection name not defined!'],
    'ConflitId': (b, c) => [409, `${a}: id "${c}" already exists to "${b}"`],
    'conflit': (a, b) => [409, a],
    'documentKey': a => [400, `invalid document key from ${a}`],
    'DocumentKeyRequired': (b) => [412, `${a}: Document Key is required to ${b}`],
    'FromAndToRequired': (b) => [412, `${a}: From and To is required to ${b}`],
    'NotFound': (a, b) => [404, ((a, b) => `${a}not found${b}`)(a ? `${a} ` : '', b ? ` ({${b})` : '')],
    'NotFoundById': (a) => [404, `(${a}) - not found!`],
    'unchanged': (a, b) => [409, (b => `unchanged ${a}`)(b && ` (${b})` || '')],
    'unremoved': (a, b) => (b => `unremoved ${a}`)(b && ` (${b})` || '')
  });

class Document extends Model {
  
  // keydata: quando for aresta dever ser um array com
  // doctKey, fromId, toId
  // exemple.createDocument([doctKey, fromIf, toId], rawdata, opts)
  static createDocument(keydata, rawdata = {}, opts = {}) {
    return new Promise((resolve, reject) => {
      
      if (!Array.isArray(keydata)) keydata = [keydata];
      if (!keydata[0]) return reject(errorsMsg('DocumentKeyRequired', this.name));
      
      keydata.unshift(this.collectionName);

      Reflect.set(opts, 'defaults', { keydata, rawdata });
      Reflect.set(opts, 'raw', true);
      Reflect.set(opts, 'plain', true);
      Reflect.set(opts, 'paranoid', false);
      Reflect.set(opts, 'attributes', ['id']);
      Reflect.set(opts, 'where', {});
      
      ['collsKey', 'doctKey', 'fromId', 'toId'].splice(0, keydata.length).map((key, ind) => {
        Reflect.set(opts.where, key, ind < 2 ? md5(keydata[ind]) : keydata[ind]);
      });

      super.findOrCreate(opts).then(([{ id }, created]) => {
        if (created) {
          const _id = md5(Object.values(opts.where).join(''));
          resolve({ 'result': { _id } });
        }
        else reject(errorsMsg('ConflitId', this.name, keydata[1]));
      }).catch(reject);
      
    });
  }
  
  static get collectionName() {
    return this.name.toLowerCase();
  }
  
  static attributes(name, ...args) {
    return ['id', 'rawdata', Document.fnJsonExtractTo(`${name}.keydata`, 1, 'key')].concat(...args);
  }
  
  /** @param {object} opts */
  static fetchAll(opts = {}) {
    Reflect.has(opts, 'raw') ||
      Reflect.set(opts, 'raw', true);
    return this.findAll(opts);
  }
  
  static fetchAllCollections(opts = {}) {
    
    const
      { name, collectionName } = this,
      hasAttributes = Reflect.has(opts, 'attributes');

    if (!hasAttributes) {
      Reflect.has(opts, 'attributes') || Reflect.set(opts, 'attributes', []);
      opts.attributes.push(...this.attributes(name));
    }

    {
      Reflect.has(opts, 'where') || Reflect.set(opts, 'where', {});
      const arg = where(col(`${name}.collsKey`), Op.eq, md5(collectionName));
      Reflect.has(opts.where, Op.and) ?
        Reflect.get(opts.where, Op.and).push(arg) :
        Reflect.set(opts.where, Op.and, [arg]);
    }

    ['Inherit', 'From', 'To'].some(key => {
      !Reflect.has(this, key) ||
        ((_model = Reflect.get(this, key)) =>
          _model && (Reflect.has(opts, 'include') || Reflect.set(opts, 'include', [])) &&
          opts.include.push(Document._include(hasAttributes, _model))
        )() ||
        hasAttributes ||
        opts.attributes.push(`${key.toLowerCase()}Id`);
    });

    return new Promise((resolve, reject) => {

      this.fetchAll(opts).then(result => {
        if (!result) reject(errorsMsg('NotFound', collectionName));
        else if (opts.plain) resolve({ 'result': this._parse(result) });
        else if (Array.isArray(result)) resolve({ 'result': result.map(arg => this._parse(arg)) });
        else resolve({ result });
      }).catch(error => {
        console.warn(101, __filename, error);
        reject(error);
      });
    });
  }
  
  static fetchDocumentById(id, opts = {}) {
    return new Promise((resolve, reject) => {
      
      Reflect.set(opts, 'where', { id });
      Reflect.set(opts, 'limit', 1);
      Reflect.set(opts, 'plain', true);
      
      Reflect.has(opts, 'paranoid') ||
      Reflect.set(opts, 'paranoid', false);
      
      {
        const args = this.attributes(this.name);
        Reflect.has(opts, 'attributes') ?
        Reflect.get(opts, 'attributes').push(...args) :
        Reflect.set(opts, 'attributes', args);
      }

      this.fetchAll(opts).then(result => {
        if (result) resolve(this._parse(result));
        else reject(errorsMsg('NotFoundById', this.collectionName, id));
      }).catch(reject);
      
    });
  }
  
  static fetchDocument(documentKey, opts = {}) {
    return new Promise((resolve, reject) => {
    
      if (!documentKey) return reject(errorsMsg('documentKey'));
      
      Reflect.has(opts, 'where') || Reflect.set(opts, 'where', {});
      
      {
        const arg = where(col(`${this.name}.doctKey`), Op.eq, md5(documentKey));
        Reflect.has(opts.where, Op.and) ?
        Reflect.get(opts.where, Op.and).push(arg) :
        Reflect.set(opts.where, Op.and, [arg]);
      }
      
      this.fetchOneCollection(opts).then(({ result = {}}) => {
        resolve({ 'result': Reflect.get(result, documentKey) });
      }).catch(reject);
      
    });
  }
  
  static fetchOneCollection(opts = {}) {

    [
      ['limit', 1],
      ['plain', true]
    ].every(([key, val]) => Reflect.set(opts, key, val));
      
    return this.fetchAllCollections(opts);
  }
  
  /**
   * @param {*} arg0 - column name
   * @param {*} arg1 - key name
   */
  static fnJsonExtract(arg0, arg1) {
    return fn('JSON_UNQUOTE', fn('JSON_EXTRACT', col(arg0), `$[${arg1}]`));
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
  
  static fnJsonValue(field, path) {
    return fn('JSON_VALUE', col(field), `$.${path}`);
  }
  
  static fnJsonValueTo(field, path, alias) {
    return [this.fnJsonValue(field, path), alias];
  }
  
  static fromJsonToCsv(data, head = [], body = []) {
    

    if (Array.isArray(data)) {
      if (0 == data.length) return [];
      const body = data.map(a => Document.fromJsonToCsv(a, head )[1]).map(a => undefined === a ? undefined : a);
      return [head].concat(body);
      
      
      
      
      // if (opts.head) {
        
      // }
    //   hasHead = !head;
    //   head || (head = []);
    //   const body = data.map(_data => Document.fromJsonToCsv(_data, head, true));
    //   return [ head, body ];
    }
    
    else {

      for (const [key, val] of Object.entries(data)) {
        let ind =  head.indexOf(key);
        if (ind < 0) {
          head.push(key);
          ind = head.length -1;
        }
        body[ind] = 'object' === typeof(val) && !Array.isArray(val) ? Document.fromJsonToCsv(val) : val;
      }

      if (0 == head.length) return [];
      return [ head, body];
      
    }
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

    ['keydata', 'rawdata'].some(key => {
      Reflect.has(attrs, key) || Reflect.set(attrs, key, {
        'type': DataTypes.JSON,
        'allowNull': false
      });
    });
    
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
  
  static patchCollection(values = {}, options = {}) {
    return new Promise((resolve, reject) => {
      
      // JSON_MERGE_PATCH was introduced in MariaDB 10.2.25, MariaDB 10.3.16 and MariaDB 10.4.5
      // const args = Object.entries(values).reduce((acc, [key, val]) => acc.concat(`${key}`).concat(val), []);

      const args = (() => {
        const [upds, rems] = [[], []];
        for (const [k, v] of Object.entries(values)) null == v ? rems.push(`$.${k}`) : upds.push(`$.${k}`, v);
        const arg0 = rems.length ? fn('JSON_REMOVE', col(`rawdata`), ...rems) : undefined;
        return upds.length && fn('JSON_SET', arg0 || col(`rawdata`), ...upds) || arg0;
      })();
      if (!args) return reject(errorsMsg('unchanged', this.collectionName));
      
      // JSON_MERGE_PATCH was introduced in MariaDB 10.2.25, MariaDB 10.3.16 and MariaDB 10.4.5
      // const rawdata = fn('JSON_COMPACT', fn('JSON_MERGE_PATCH', col(`rawdata`), fn('JSON_OBJECT', ...args)));

      const rawdata = fn('JSON_COMPACT', args);
      
      super.update({ rawdata }, options).then(([updated]) => {
        if (updated) resolve({ 'code': 204 });
        else reject(errorsMsg('unchanged', this.collectionName));
      }).catch(error => {
        log(360, ...Object.entries(error));        
        reject(error.name && error.name.startsWith('Sequelize') && {
          'code': 409,
          'message': (error.errors || [error]).map(arg => `${arg.type} in "${arg.instance.toString().split(':')[1].slice(0, -1)}"`).join(', ')
        } || error);
      });
      
    });
  }

  static patchDocument(id, values, options = {}) {
    Reflect.set(options, 'where', where(col('id'), Op.eq, id));
    return this.patchCollection(values, options);
  }
  
  static get prefixTableName() {
    return  (a => a && (b => b && `${b}_`)(a.prefixTableName) || '')(this.sequelize.options.define);
  }
  
  static regexpReplaceToSql(arg) {
    return `JSON_UNQUOTE(REGEXP_REPLACE(${arg}, '[[]|[]]', ''))`;
  }
  
  static removeCollection(options = {}) {
    return new Promise((resolve, reject) => {
      
      Reflect.has(options, 'where') || 
      Reflect.set(options, 'where', {});
      
      const { collectionName } = this;
      Reflect.set(options.where, 'collsKey', md5(collectionName));
  
      super.destroy(options).then(result => {
        if (result) resolve({ 'code': 204 });
        else reject(errorsMsg('unremoved', 'collection', collectionName));
      }).catch(error => {
        reject((error.name && error.name.startsWith('Sequelize')) ?
          errorsMsg('unremoved', 'collection', error.errors.map(arg => `${arg.type} in "${arg.instance.toString().split(':')[1].slice(0, -1)}"`).join(', ')) : 
          error
        );
      });
    });
  }
  
  static removeDocument(documentKey, options = {}) {
    return new Promise((resolve, reject) => {
      
      if (!documentKey) return reject(errorsMsg('documentKey'));
      
      Reflect.has(options, 'where') || 
      Reflect.set(options, 'where', {});
      Reflect.set(options.where, 'doctKey', md5(documentKey));
      
      this.removeCollection(options).then(resolve).catch(error => {
        reject(error.code == 400 ? errorsMsg('unchanged', 'document', documentKey) : error);
      });
      
    });
  }
  
  static startTransaction() {
    return this.sequelize.transaction;
  }
  
  static sync(options = {}) {
    
    const
      tableName = this.getTableName(),
      attrs = [
//        '`keydata` JSON NOT NULL UNIQUE CHECK (JSON_VALID(`keydata`))',
        '`keydata` JSON NOT NULL CHECK (JSON_VALID(`keydata`))',
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
        '`id` CHAR(32) AS (MD5(CONCAT(`collsKey`, `doctKey`, IFNULL(`fromId`, ""), IFNULL(`toId`, ""), IFNULL(`deletedAt`, "")))) VIRTUAL UNIQUE', 'CHECK (`id` IS NOT NULL)',
        `FOREIGN KEY (\`fromId\`) REFERENCES \`${tableName}\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT`,
        `FOREIGN KEY (\`toId\`) REFERENCES \`${tableName}\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT`
      ];
      
    return this.sequelize.query(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (${attrs.join(',')}) ENGINE=InnoDB`);
  }

  static _fnJsonValueQuery(fnJson, arg, opts) {
    if (undefined == opts) [arg, opts] = ['rawdata', arg];
    if ('string' === typeof(arg)) arg = col(arg);
    opts = 'string' === typeof(opts) ? `$.${opts}` : fn('CONCAT', '$.', opts);
    return fn(fnJson, arg, opts);
  }
  
  static _include(hasAttributes, model, ...args) {
    
    const opts = { model, 'required': false, 'paranoid': false, 'include': [] };
    
    Reflect.set(opts, 'attributes', hasAttributes && [] || this.attributes(args.reduce(
      (acc, { options }) => acc.concat(options.name.singular),
      [model.options.name.singular]
    ).reverse().join('->')));

    for (const key of ['Inherit', 'From', 'To']) {
      !Reflect.has(model, key) ||
      ((_model = Reflect.get(model, key)) => 
        _model && opts.include.push(Document._include(hasAttributes, _model, model))
      )() || hasAttributes || opts.attributes.push(`${key.toLowerCase()}Id`);
    }

    return opts;
  }
  
  static _parse(resp) {
    
    const rawdata = resp.rawdata ?
      (({ rawdata, id, key } = resp) => Object.assign({}, rawdata, { '_id': id, '_key': key }))() :
      Object.entries(resp).reduce((a, [k, v]) => (null == v || Reflect.set(a, k, v)) && a, {});

    for (const arg of ['Inherit', 'From', 'To']) if (Reflect.has(this, arg)) {
      const 
        key = `_${arg.toLowerCase()}`,
        obj = Reflect.get(this, arg);
        
      {
        const attr = `${key.slice(1)}Id`;
        
        if (Reflect.has(resp, attr)) {
          Reflect.set(rawdata, key, Reflect.get(resp, attr));
          continue;
        }
      }

      if (obj) {
        const 
          _name = `${obj.name}.`,
          _data = Object.entries(resp)
            .filter(([key]) => key.startsWith(_name))
            .map(([key, val]) => [key.replace(_name, ''), val])
            .reduce((acc, [key, val]) => Reflect.set(acc, key, 'rawdata' === key ? JSON.parse(val) : val) && acc, {});
            
        Reflect.has(_data, 'rawdata') && 
        Reflect.set(rawdata, key, this._parse.call(obj, _data));
      }
        
    }

    return rawdata;
  }

}

module.exports = { 
  pool, 
  dialect, 
  dialectOptions, 
  uniqueId, 
  Document
};