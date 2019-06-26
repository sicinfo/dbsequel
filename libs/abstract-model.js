/**
 * application: dbsequel
 * 
 * powered by Moreira in 2019-06-22
 */
 
const log = (a, ...b) => console.log(a, __filename, ...b);
log('loading...');

const symb = Symbol();

module.exports = class Abstract extends require('sequelize').Model {
  
  constructor(args) {
    this[symb] = {
      'appname': args.appname
    };
  }
  
  get appname() {
    return this[symb].appname;
  }
  
};