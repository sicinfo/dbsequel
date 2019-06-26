/**
 * application: dbsequel
 * 
 * Powered [1.0.0] by Moreira in 2019-06-22
 */
const log = (a, ...b) => console.log(a, __filename, '\n', ...b);
log('loading...');

const 
  symb = Symbol(),
  Sequelize = require('sequelize');

module.exports = class Db {
  
  constructor(args) {
    
    this[symb] = {
      'operatorsAliases': args.operatorsAliases || Sequelize.Op,
      'dirname': args.dirname,
      'dbconfig': 
    };

  }
  
  get connect() {
    const { database, username, password, dialect, dialectOptions } = this;
    return new Sequelize(database, username, password, { dialect, dialectOptions });
  }
  
  get dbconfig() {
    
  }

  get dialect() {}
  get dialectOptions() { return {} }
  get database() {}
  get username() {}
  get password() {}
  
  get dirmodels() {
    return 'models';
  }
  
  get prefixTableName() {
    return '';
  }
  
  get Op() {
    return this[symb].operatorsAliases;
  }
  
};