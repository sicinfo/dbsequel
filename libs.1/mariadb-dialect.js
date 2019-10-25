/**
 * application: dbsequel
 * 
 * Powered [1.0.0] by Moreira in 2019-06-22
 */
const log = (a, ...b) => console.log(a, __filename, '\n', ...b);
log('loading...');

module.exports = class Mariadb extends require('abstract-dialect') {
  get dialect() {
    return 'mariadb';
  }
  get dialectOptions() {
    return { 'connectionTimeout': 1000 };
  }
};