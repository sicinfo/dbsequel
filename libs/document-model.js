/**
 * application: dbsequel
 * 
 * powered by Moreira in 2019-06-22
 */

const log = (a, ...b) => console.log(a, __filename, '\n', ...b);
log('loading...');

const 
  symb = Symbol(),
  { newId } = require('sicinfo-idcreate'),
  Joi = require('joi');

module.exports = class Document extends require('./abstract-model') {
  
  constructor(args) {
    super(args);
    
    this[symb] = {
      
    };
    
  }

  static findOne(opts = {}) {
    const hasAttrs = opts.attributes;
    if (!hasAttrs) opts.attributes = ['memo'];
    return super.findOne(opts)
      .then(resp => {
        return resp && (hasAttrs && resp.dataValues || resp.dataValues.memo);
      });
  }
  
  static create(memo) {
    return super.create({ memo });
  }

  static async sync(attrs = [], opts = {}) {
    const { sequelize, tableName } = this;
    if (!(sequelize && tableName)) return;
    
    const _attrs = [`\`_key\` CHAR(10) KEY`];
    if (opts.inherit) attrs.push(opts.inherit);
    if (opts.from) _attrs.push(opts.from);
    if (opts.to) _attrs.push(opts.to);
    
    _attrs.push(
      `\`version\` INTEGER NOT NULL DEFAULT 0`,
      `\`createdAt\` DATETIME NOT NULL`,
      `\`updatedAt\` DATETIME NOT NULL`,
      `\`deletedAt\` DATETIME`,
      `\`memo\` JSON NOT NULL CHECK (JSON_VALID(\`memo\`))`
    );
    
    if ('string' === typeof attrs) attrs = [attrs];
    if (attrs.length) _attrs.push(...attrs.map(arg => {
      if ('string' === typeof arg) arg = [arg];
      arg = arg.map(a => {
        if ('string' === typeof a) a = [a];
        if (a.length == 1) a.push(`JSON_VALUE(\`memo\`, "$.${a[0]}")`);
        return a;
      });
      const name = [], value = [];
      for (let i = 0; i < arg.length; i++) {
        name.push(arg[i][0]);
        value.push(arg[i][1]);
      }
      if (value.length > 1) value[0] = `CONCAT(${value.join(',')})`;
      return `${name.join('_')} CHAR(32) AS (MD5(${value[0]})) VIRTUAL UNIQUE`;
    }));
    
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${_attrs.join(',')}) ENGINE=InnoDB`
    );
  }
  
  static init(attrs = {}, opts = {}, schema, DataTypes) {
    super.init(
      Object.assign({
        'memo': {
          'type': DataTypes.JSON,
          'defaultValue': '{}',
          'allowNull': false,
          'check': '(JSON_VALID(memo))',
          'validate': {
            isEven(data) {
              if (Joi.validate(data, schema, { 'allowUnknown': true }).error !== null)
              throw new Error('schema error');
            }
          }
        },
        '_key': {
          'type': DataTypes.CHAR(10),
          'allowNull': false,
          'defaultValue': newId,
          'primaryKey': true
        }
      }, attrs),
      Object.assign({
        'freezeTableName': true,
        'timestamps': true,
        'paranoid': true,
        'version': true
      }, opts)
    );
  }

};