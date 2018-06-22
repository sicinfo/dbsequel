/**
 * application: sicinfo-dbsequel
 * module: lib/dbsequel.js
 * 
 * Powered [0.0.1] by Moreira in 2017-05-25
 **/

const Sequelize = require('sequelize');
const { join } = require('path');
const { readdir, readFile } = require('fs');
const { newId } = require('sicinfo-idcreate');
const { Op } = Sequelize;
const { isArray } = Array;

const Datatypes = { Sequelize };

['INTEGER', 'TINYINT', 'REAL', 'DATE', 'ENUM', 'STRING', 'TEXT', 'VIRTUAL'].forEach(key => Datatypes[key] = Sequelize[key]);

Datatypes.SECUNDARYKEY = {
  'type': Datatypes.STRING,
  'primaryKey': true
};

Datatypes.PRIMARYKEY = {
  'type': Datatypes.STRING,
  'primaryKey': true,
  'defaultValue': () => newId()
};

const parseQueryValues = one => resp => {
  if (isArray(resp)) { resp = { 'rows': resp } }
  if (resp.rows.length == 0) { resp.rows = one ? {} : [] }
  else if (one) { resp.rows = resp.rows[0] }
  else {
    const head = Object.keys(resp.rows[0]);
    resp.rows = [head].concat(resp.rows.map(row => head.map(key => row[key])));
  }
  return resp;
}

const parseFindValues = one => resp => {
  if (isArray(resp)) { resp = { 'rows': resp } }
  if (resp.rows.length == 0) { resp.rows = one ? {} : [] }
  else if (one) { resp.rows = resp.rows[0].dataValues }
  else {
    const incl = {};
    const { rows } = resp;
    let pos = 0;
    resp.rows = [[]];
    Object.keys(rows[0].dataValues).some(key => {
      const val = rows[0].dataValues[key];
      if (val && 'object' === typeof (val) && 'dataValues' in val) {
        incl[key] = true;
        Object.keys(val.dataValues).some(key => { resp.rows[0][pos++] = key });
      }
      else resp.rows[0][pos++] = key
    });
    rows.forEach((row, ind) => {
      resp.rows[ind + 1] = [];
      pos = 0;
      Object.keys(row.dataValues).forEach(key => {
        const val = row.dataValues[key];
        if (incl[key]) Object.keys(val.dataValues).forEach(key => {
          resp.rows[ind + 1][pos++] = val.dataValues[key];
        })
        else {
          resp.rows[ind + 1][pos++] = val;
        }
      })
    });
  }
  return resp;
}

// const failFind = done => err => done(err.name && (
//   `${err.name} - ${err.original && err.original.code || ''}`    
// ) || err);
const _failDone = err => {

  console.log(err);

  const msg = err.original && (
    `${err.name} - ${err.original.code || err.original}`
  ) /*|| err.message*/ || err;

  return msg;
};

const _query = (sequelize, sqlString, options = {}) => {
  'type' in options || (options.type = Sequelize.QueryTypes.SELECT);
  return sequelize.query(options.one ? `${sqlString} LIMIT 1` : sqlString, options)
    .then(parseQueryValues(options.one))
    .catch(_failDone);
};

const _fetch = (model, options = {}) => {
  return (model.primaryKeyAttributes.every(
    primaryKeyAttribute => primaryKeyAttribute in options
  ) ? _findById : _findAll)(model, options);
};

const _findAll = (model, options = {}, _options = {}) => {

  if ('where' in options === false) {
    options.where = {};
  }

  _options.byId || Object.keys(options.where)
    .filter(key => options.where[key].split('').some(a => '%' === a))
    .map(key => { options.where[key] = { [Op.like]: options.where[key] } });

  return model[`find${options.count ? 'AndCount' : ''}All`](options)
    .then(parseFindValues(_options.one))
    .catch(_failDone);

};

const _findOne = (model, options = {}) => {
  options.limit = 1;
  return _findAll(model, options, { 'one': true });
};

const _findById = (model, options = {}) => {
  options.where = {};
  model.primaryKeyAttributes
    .filter(pka => pka in options)
    .forEach(pka => { options.where[pka] = options[pka] });
  return _findAll(model, options, { 'byId': true, 'one': true });
};

const _update = (model, args) => {
  const where = args.where || {};
  const data = {};
  model.primaryKeyAttributes.map(key => {
    key in where || (where[key] = args[key]);
  });
  Object.keys(args.data)
    .filter(key => key in where === false)
    .map(key => { data[key] = args.data[key] });
  return model.update(data, { where })
    .then(rows => ({ rows }))
};

const _delete = (model, args) => {
  if (!model.primaryKeyAttributes.every(key => key in args)) {
    return new Promisse((a, b) => b('erro'));
  }
  const where = args.where || {};
  model.primaryKeyAttributes.map(key => {
    key in where || (where[key] = args[key]);
  });
  return model.destroy({ where })
    .then(rows => ({ rows }))
}

const _save = (model, args) => {
  if (model.primaryKeyAttributes.every(key => key in args)) {
    return _update(model, args)
  }
  return model.create(args.data);
};

/**
 * @param {*} opts 
 */
module.exports = function ({ database, username, password, options = {}, dirmodels, prefixTableName = '' }) {

  if ('operatorsAliases' in options === false) {
    options.operatorsAliases = Op;
  }

  const sequelize = new Sequelize(database, username, password, options);
  const relations = {};
  const files = {};

  return new Promise((resolve, reject) => sequelize.authenticate()
    .then(() => readdir(dirmodels, (err, args) => {

      // console.log(dirmodels);

      if (err) return reject({ err });

      // filtrar somente arquivos com nomes no padrão
      args.filter(
        arg => /\d\d-[A-Z]/.test(arg.slice(0, 4)) && arg.endsWith('.js')
      ).map(_filename => {

        // ler e o arquivos para Sequelize
        const name = _filename.split('.')[0].slice(3);
        const modelFile = files[name] = require(join(dirmodels, _filename));

        // 0 - estrutura
        // 1 - opções
        // 2 - relações
        modelFile.schema(Datatypes, (schemas) => {

          if ('schema' === Object.keys(schemas)[0]) {
            schemas = (obj => (obj[name] = schemas, obj))({})
          }

          Object.keys(schemas).forEach(name => {
            const { schema, options = {}, associations } = schemas[name];

            if (!('tableName' in options)) {
              options.tableName = `${prefixTableName}${name.toLowerCase()}`;
            }

            if (associations) {
              relations[name] = associations;
            }

            return sequelize.define(name, schema, options);
          });
        });
      }).some(() => Object.keys(relations).forEach(fileName => {

        const model = sequelize.models[fileName];

        ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].forEach(arg => {

          if (arg in relations[fileName] && isArray(relations[fileName][arg])) {
            relations[fileName][arg].forEach(relation => {

              if ('string' === typeof (relation)) {
                relation = { 'target': relation }
              }

              const { target, options = {} } = relation;

              model[arg](sequelize.models[target], options)
            });
          }
        });

      }));

      // arg -> nome do model
      // quando não tiver model o paramentro arg deve ser null
      // e será retornado o objeto sequelize
      return resolve(modelName => {

        // console.log(modelName);

        if ('string' === typeof (modelName)) {
          const _call = _back => options => {

            // console.log(modelName);
            // console.log(options);

            return _back(sequelize.models[modelName], options);
          }
          return {
            'fetch': _call(_fetch),
            'findAll': _call(_findAll),
            'findOne': _call(_findOne),
            'findById': _call(_findById),
            'save': _call(_save),
            'update': _call(_update),
            'delete': _call(_delete),
            'models': sequelize.models
          }
        }

        else return {
          'query': (sqlString, options) => {
            return _query(sequelize, sqlString, options);
          },
          'models': sequelize.models
        }
      })
    }))
  );

};
