/**
 * application: dbsequel
 * 
 * powered by Moreira in 2019-06-22
 */

const log = (a, ...b) => console.log(a, __filename, '\n', ...b);
log('loading...');

const 
  md5 = require('blueimp-md5'),
  { DataTypes } = require('sequelize');

module.exports = class DocumentModel extends require('./abstract-model') {
  
  static createDocument(collectionName, documentKey, values = {}, options) {
    return this.createCollection(collectionName, (a => (a[documentKey] = values, a))({}), options);
  }
  
  static fetchDocument(collectionName, documentKey) {
    return this.fetchOneCollection(collectionName, { 'where': { 'doct': md5(documentKey) } });
  }
  
  static sync(attrs = []) {
    const doct = this.regexpReplaceToSql(
      this.jsonKeysToSql(
        this.jsonQueryToSql(this.regexpReplaceToSql(this.jsonKeysToSql())
        )
      )
    );
    
    return super.sync([
      `\`doct\` CHAR(32) AS (MD5(${doct})) VIRTUAL`, 
      'INDEX (`doct`)',
      'UNIQUE (`colls`, `doct`)'
    ].concat(...attrs));
  }

  static init(attrs, opts) {
    super.init(Object.assign({}, attrs), opts);
  }
  
};