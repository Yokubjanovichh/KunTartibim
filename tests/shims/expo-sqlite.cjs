/**
 * Testlar uchun expo-sqlite oʻrnini bosuvchi — Node'ning oʻz SQLite'i (node:sqlite).
 * Ilova ishlatadigan sinxron API'ning kichik qismi: execSync, getFirstSync,
 * getAllSync, runSync, withTransactionSync. Har bir nom uchun xotiradagi baza.
 */
const { DatabaseSync } = require('node:sqlite');

const dbs = new Map();

function wrap(db) {
  const args = (params) => (params === undefined ? [] : Array.isArray(params) ? params : [params]);
  // node:sqlite qatorlari null-prototipli obyekt — oddiy obyektga aylantiramiz
  const plain = (row) => (row === undefined || row === null ? null : { ...row });
  return {
    execSync(sql) {
      db.exec(sql);
    },
    getFirstSync(sql, params) {
      return plain(db.prepare(sql).get(...args(params)));
    },
    getAllSync(sql, params) {
      return db.prepare(sql).all(...args(params)).map(plain);
    },
    runSync(sql, params) {
      const r = db.prepare(sql).run(...args(params));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    withTransactionSync(task) {
      db.exec('BEGIN');
      try {
        task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

exports.openDatabaseSync = (name) => {
  if (!dbs.has(name)) dbs.set(name, wrap(new DatabaseSync(':memory:')));
  return dbs.get(name);
};
