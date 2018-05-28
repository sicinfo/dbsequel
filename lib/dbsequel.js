/**
 * application: sicinfo-dbsequel
 * module: lib/dbsequel.js
 * 
 * Powered [0.0.1] by Moreira in 2017-05-25
 **/

const Sequelize = require('sequelize');
const { join } = require('path');
const { readdir } = require('fs');
const { newId } = require('asmore-id');
const { Op } = Sequelize;
const { isArray } = Array;
const Datatypes = {

  'INTEGER': Sequelize.INTEGER,
  'REAL': Sequelize.REAL,
  'DATE': Sequelize.DATE,
  'ENUM': Sequelize.ENUM,
  'STRING': Sequelize.STRING,
  'STRING': Sequelize.TEXT,
  'VIRTUAL': Sequelize.VIRTUAL,

  'SECUNDARYKEY': {
    'type': Sequelize.STRING,
    'primaryKey': true
  },

  'PRIMARYKEY': {
    'type': Sequelize.STRING,
    'primaryKey': true,
    'defaultValue': () => newId()
  },

  Sequelize

};

// const failFind = done => err => done(err.name && (
//   `${err.name} - ${err.original && err.original.code || ''}`    
// ) || err);
const _failDone = err => {
  const msg = err.original && (
    `${err.name} - ${err.original.code || err.original}`
  ) || err.message || err;

  return msg;
};

const _query = (sqlString, sequelize, options = {}) => {

  'type' in options || (options.type = sequelize.QueryTypes.SELECT);
  options.one && (sqlString = `${sqlString} LIMIT 1`);

  return sequelize.query(
    sqlString,
    {
      model,
      bind,
      replacecements,
      type = sequelize.QueryTypes.SELECT
    } = options
  ).then(resp => {

    resp = { 'rows': resp };

    if (!(resp.rows.length)) {
      resp.rows = options.one ? {} : []
    }

    else if (options.one) {
      resp.rows = resp.rows[0]
    }

    else {

      const head = Object.keys(resp.rows[0]);
      resp.rows = [head].concat(
        resp.rows.map(row => head.map(key => row[key]))
      );

    }

    return resp;
  })
    .catch(_failDone);

};

const _fetch = (model, args = {}) => {

  return (model.primaryKeyAttributes.every(
    arg => arg in args
  ) ? _findById : _findAll)(model, args);

};

const _findAll = (model, args = {}, opts = {}) => {

  'where' in args || (args.where = {});

  opts.byId || Object.keys(args.where)
    .filter(key => args.where[key].split('').some(a => '%' === a))
    .map(key => { args.where[key] = { [Op.like]: args.where[key] } });

  return model[`find${args.count ? 'AndCount' : ''}All`](args)
    .then(resp => {

      if (isArray(resp)) {
        resp = { 'rows': resp }
      }

      if (resp.rows.length == 0) {
        resp.rows = opts.one ? {} : []
      }

      else if (opts.one) {
        resp.rows = resp.rows[0].dataValues
      }

      else {
        const head = Object.keys(resp.rows[0].dataValues);
        resp.rows = [head].concat(
          resp.rows.map(row => head.map(key => row.dataValues[key]))
        );
      }

      return resp;
    })
    .catch(_failDone);

};

const _findOne = (model, args = {}) => {
  args.limit = 1;
  return _findAll(model, args, { 'one': true });
};

const _findById = (model, args = {}) => {
  args.where = {};

  model.primaryKeyAttributes
    .filter(key => key in args)
    .map(key => { args.where[key] = args[key] });

  return _findAll(model, args, { 'byId': true, 'one': true });
};

const _update = (model, args) => {

  const where = args.where || {};
  const data = {};

  model.primaryKeyAttributes.map(key => {
    key in where || (where[key] = args[key]);
  });

  Object.keys(args.data)
    .filter(key => !(key in where))
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
module.exports = ({
  database,
  username,
  password,
  options = {},
  dirmodels,
  prefixTableName = ''
}) => {

  'operatorsAliases' in options || (options.operatorsAliases = Op);

  const sequelize = new Sequelize(database, username, password, options);
  const relations = {};
  const files = {};

  return new Promise((resolve, reject) => sequelize.authenticate()
    .then(() => readdir(dirmodels, (err, args) => {

      if (err) return reject({ err });

      // filtrar somente arquivos com nomes no padrão
      args.filter(
        arg => /\d\d-[A-Z]/.test(arg.slice(0, 4)) && arg.endsWith('.js')
      ).map(_filename => {

        // ler e o arquivos para Sequelize
        const name = _filename.split('.')[0].slice(3);
        const file = files[name] = require(join(dirmodels, _filename));

        // 0 - estrutura
        // 1 - opções
        // 2 - relações
        file.schema(Datatypes, (...schemas) => {

          (
            isArray(schemas[0])
              ? schemas[0]
              : [[name, schemas[0], schemas[1], schemas[2]]]
          ).map(args => {

            const filename = args[0];
            const schema = args[1];
            const options = args.length > 2 && 'object' === typeof args[2] ? args[2] : {};

            'tableName' in options || (
              options.tableName = `${prefixTableName}${filename.toLowerCase()}`
            )

            args.length > 3 && args[3] && (
              relations[filename] = args[3]
            );

            return sequelize.define(filename, schema, options);
          });
        });
      }).some(() => Object.keys(relations).forEach(fileName => {

        const model = sequelize.models[fileName];

        ['belongsTo', 'hasOne', 'hasMany'].forEach(arg => {

          arg in relations[fileName] &&
            isArray(relations[fileName][arg]) &&
            relations[fileName][arg].forEach(relation => {

              let name, opts;

              [name, opts] = isArray(relation)
                && relation.concat({})
                || [relation, {}];

              model[arg](sequelize.models[name], opts)
            });
        });

      }));

      // arg -> nome do model
      // quando não tiver model o paramentro arg deve ser null
      // e será retornado o objeto sequelize
      resolve(arg => {

        if ('string' === typeof (arg)) {

          const parse = (name, callBack) => opts => {
            return callBack(sequelize.models[name], opts);
          }

          return {
            'fetch': parse(arg, _fetch),
            'findAll': parse(arg, _findAll),
            'findOne': parse(arg, _findOne),
            'findById': parse(arg, _findById),
            'save': parse(arg, _save),
            'update': parse(arg, _update),
            'delete': parse(arg, _delete)
          }
        }

        else return {
          'query': (sqlString, options) => _query(
            sqlString, sequelize, options
          )
        }


        //   return arg(opts => {

        //   console.log(275, __filename, opts)

        //     opts.sequelize = sequelize;

        //     return opts;
        //   });


        // return opts => {
        //   opts.sequelize = sequelize;
        //   return arg(opts);
        // }
        // }

      });

    }))
  );

};
