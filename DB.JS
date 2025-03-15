const mariadb = require('mariadb');

const pool = mariadb.createPool({
    host: 'localhost',
    user: 'root',
    password: '123',
    database: 'conversor_monedas',
    port: 3306,
    connectionLimit: 10
});

module.exports = pool;