/**
 * application: dbsequel
 * 
 * powered by Moreira in 2019-06-22
 */

const log = (a, ...b) => console.log(a, __filename, '\n', ...b);
log('loading...');

module.exports = class Edge extends require('./document-model') {
  
  static sync(from, to, attrs = []) {
    from = `\`_from\` CHAR(10) NOT NULL REFERENCES \`${from.tableName}\` ON DELETE RESTRICT ON UPDATE RESTRICT`;
    to = `\`_to\` CHAR(10) NOT NULL REFERENCES \`${to.tableName}\` ON DELETE RESTRICT ON UPDATE RESTRICT`;
    super.sync(attrs, { from, to });
  }

  static init(attrs = {}, opts = {}, schema = {}, DataTypes) {
    super.init(
      Object.assign({
        '_from': {
          'type': DataTypes.CHAR(10),
          'allowNull': false
        },
        '_to': {
          'type': DataTypes.CHAR(10),
          'allowNull': false
        }
      }, attrs),
      opts, schema, DataTypes
    );
  }
    

};