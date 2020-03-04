/**
 * application: dbsequel
 * powered by moreira
 */
 
const 
  { expect } = require('chai'),
  { Document } = require('../libs/mariadb-dialect');

describe('Document static functions', () => {
  
  it('#1 fromJsonToCsv', () => {
    const _array = Document.fromJsonToCsv({});
    expect(_array).to.be.an('array');
    expect(_array.length).to.equal(0);
  });
    
  it('#2 fromJsonToCsv', () => {
    const _array = Document.fromJsonToCsv({'a':1, 'b': 2});
    expect(_array).to.be.an('array');
    expect(_array.length).to.equal(2);
    expect(_array[0].join('')).to.equal('ab');
    expect(_array[1].join('')).to.equal('12');
  });
  
  it('#3 fromJsonToCsv', () => {
    const _array = Document.fromJsonToCsv({ 'a': 1, 'b': [2, 3] });
    expect(_array).to.be.an('array');
    expect(_array.length).to.equal(2);
    expect(_array[0].join('')).to.equal('ab');
    expect(_array[1][0]).to.equal(1);
    expect(_array[1][1][0]).to.equal(2);
  });
  
  it('#4 fromJsonToCsv', () => {
    const _array = Document.fromJsonToCsv({ 'a': 1, 'b': { 'a': 2, 'b': 4 }, 'c': 3 });
    expect(_array).to.be.an('array');
    expect(_array.length).to.equal(2);
    expect(_array[0].join('')).to.equal('abc');
    expect(_array[1][0]).to.equal(1);
    expect(_array[1][1]).to.be.an('array');
    expect(_array[1][1][0].join('')).to.equal('ab');
    expect(_array[1][1][1].join('')).to.equal('24');
    expect(_array[1][2]).to.equal(3);
  });
  
  it('#5 fromJsonToCsv', () => {
    const _array = Document.fromJsonToCsv([]);
    expect(_array).to.be.an('array');
    expect(_array.length).to.equal(0);
  });
    
  it('#6 fromJsonToCsv', () => {
    const _array = Document.fromJsonToCsv([{'a':1, 'c': 4},{'a':2}, {'b': 3}]);
    console.log(JSON.stringify(_array));
    expect(_array).to.be.an('array');
    expect(_array.length).to.equal(4);
    expect(_array[0].join('')).to.equal('acb');
    expect(_array[1].join('')).to.equal('14');
    expect(_array[2].join('')).to.equal('2');
    expect(_array[3].join('')).to.equal('3');
    expect(_array[3][0]).to.be.undefined;
    expect(_array[3][2]).to.equal(3);
  });
    
});